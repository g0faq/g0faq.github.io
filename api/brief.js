'use strict';

const crypto = require('node:crypto');
const { waitUntil } = require('@vercel/functions');
const { config, log } = require('./_lib/config');
const { query, transaction, hasDatabase } = require('./_lib/db');
const openai = require('./_lib/openai');
const engine = require('./_lib/brief-engine');
const reporter = require('./_lib/brief-report');

/* API опроса «Помощь с ТЗ».
 *
 *   GET  ?action=load&token=…[&preview=1]  состояние опроса по ссылке или возобновление
 *   POST { action: 'start', consent }       новый публичный опрос
 *   POST { action: 'answer', token, index, answer }
 *   POST { action: 'back', token }
 *   POST { action: 'complete', token, contact, consent }
 *
 * Клиенту никогда не возвращаются черновик ТЗ и заметки владельца — только
 * текущий вопрос, прогресс и в конце подобранные кейсы. */

const PUBLIC_TTL_DAYS = 7;
const OWNER_TTL_DAYS = Number(process.env.BRIEF_LINK_TTL_DAYS || 30);
const MAX_AI_CALLS = 32;
const IP_DAILY = Number(process.env.BRIEF_IP_DAILY_LIMIT || 6);
const GLOBAL_DAILY = Number(process.env.BRIEF_DAILY_LIMIT || 80);
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const BOT_UA = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|preview|curl|wget|python-requests|axios|scrapy/i;
const CHANNELS = ['Telegram', 'WhatsApp', 'MAX', 'Телефон', 'Почта'];

/* ── HTTP ─────────────────────────────────────────────────────────────────── */

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const fail = (res, status, code, message) => res.status(status).json({ ok: false, code, message });

/* ── Состояние для клиента ────────────────────────────────────────────────── */

const isExpired = (brief) => brief.status === 'active' && new Date(brief.expires_at) < new Date();

function clientState(brief, extra = {}) {
  const base = {
    ok: true,
    token: brief.token,
    mode: brief.mode,
    title: brief.mode === 'owner' ? brief.title : null,
    intro: brief.mode === 'owner' ? brief.client_intro : null,
  };

  if (brief.status === 'deleted') return { ...base, status: 'deleted' };
  if (brief.status === 'completed') return { ...base, status: 'completed', cases: brief.cases || [] };
  if (isExpired(brief)) return { ...base, status: 'expired' };

  const steps = brief.steps || [];
  const answered = steps.filter((step) => step.answer).length;

  if (brief.awaiting_contact) {
    return { ...base, status: 'contact', answered, progress: 100, canBack: answered > 0 };
  }

  const current = steps[steps.length - 1];
  if (!current || current.answer) {
    return { ...base, status: 'intro', answered, progress: 0, canBack: false };
  }

  return {
    ...base,
    status: 'question',
    index: steps.length - 1,
    answered,
    progress: current.progress || 0,
    total: brief.mode === 'owner' ? (brief.plan?.questions?.length || null) : null,
    question: current.question,
    answer: current.draft_answer || null,
    canBack: steps.length > 1,
    ...extra,
  };
}

/* ── Защита от злоупотреблений ────────────────────────────────────────────── */

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || '') || 'unknown';
}

/** Лимиты стартов. Адрес не хранится: только соль+дата хэш, живёт двое суток. */
async function allowStart(req) {
  const day = new Date().toISOString().slice(0, 10);
  const hash = crypto.createHash('sha256')
    .update(`${clientIp(req)}|${day}|${config.cronSecret || 'brief'}`)
    .digest('hex')
    .slice(0, 32);

  const bump = async (bucket) => (await query(
    `INSERT INTO brief_rate (bucket, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (bucket, day) DO UPDATE SET count = brief_rate.count + 1
     RETURNING count`,
    [bucket],
  )).rows[0].count;

  const perIp = await bump(`ip:${hash}`);
  if (perIp > IP_DAILY) return { ok: false, code: 'rate_ip' };
  const global = await bump('global');
  if (global > GLOBAL_DAILY) return { ok: false, code: 'rate_global' };
  return { ok: true };
}

/* ── Действия ─────────────────────────────────────────────────────────────── */

async function actionLoad(req, res) {
  const token = String(req.query.token || '');
  if (!TOKEN_RE.test(token)) return fail(res, 404, 'not_found', 'Опрос не найден');

  const brief = (await query('SELECT * FROM briefs WHERE token = $1', [token])).rows[0];
  if (!brief) return fail(res, 404, 'not_found', 'Опрос не найден');

  // Предпросмотр для владельца: вопросы целиком, без записи и уведомлений.
  if (req.query.preview === '1') {
    if (brief.mode !== 'owner') return fail(res, 404, 'not_found', 'Предпросмотр доступен только для персональных ссылок');
    return res.status(200).json({
      ok: true,
      status: 'preview',
      mode: 'owner',
      title: brief.title,
      intro: brief.client_intro,
      questions: brief.plan?.questions || [],
    });
  }

  if (brief.mode === 'owner' && !brief.opened_at && brief.status === 'active' && !isExpired(brief)) {
    const first = await query(
      'UPDATE briefs SET opened_at = now() WHERE id = $1 AND opened_at IS NULL RETURNING id',
      [brief.id],
    );
    if (first.rowCount) waitUntil(reporter.notifyOpened(brief).catch(() => {}));
  }

  return res.status(200).json(clientState(brief));
}

async function actionStart(req, res, body) {
  if (!body.consent) return fail(res, 400, 'consent', 'Нужно согласие на обработку ответов');

  // Персональная ссылка стартует со своей первой страницы, без нового опроса.
  if (body.token) {
    if (!TOKEN_RE.test(String(body.token))) return fail(res, 404, 'not_found', 'Опрос не найден');
    const state = await transaction(async (client) => {
      const brief = (await client.query('SELECT * FROM briefs WHERE token = $1 FOR UPDATE', [body.token])).rows[0];
      if (!brief) return null;
      if (brief.status !== 'active' || isExpired(brief) || brief.awaiting_contact) return clientState(brief);
      const steps = brief.steps || [];
      if (steps.length) return clientState(brief);
      const next = brief.mode === 'owner' ? engine.nextFromPlan(brief.plan, []) : null;
      if (!next || next.done) return clientState(brief);
      const updated = (await client.query(
        `UPDATE briefs SET steps = $2, last_activity_at = now() WHERE id = $1 RETURNING *`,
        [brief.id, JSON.stringify([{ question: next.question, answer: null, progress: next.progress }])],
      )).rows[0];
      return clientState(updated);
    });
    if (!state) return fail(res, 404, 'not_found', 'Опрос не найден');
    return res.status(200).json(state);
  }

  if (BOT_UA.test(String(req.headers['user-agent'] || ''))) {
    return fail(res, 403, 'bot', 'Автоматические запросы не поддерживаются');
  }

  const limit = await allowStart(req);
  if (!limit.ok) {
    return fail(res, 429, limit.code, 'Слишком много новых опросов за сегодня. Напишите мне в Telegram — помогу с ТЗ лично.');
  }

  const first = await engine.nextAdaptive([], 0);
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  const steps = [{ question: first.question, answer: null, progress: first.progress || 3 }];

  const brief = (await query(
    `INSERT INTO briefs (id, token, mode, steps, ai_calls, expires_at)
     VALUES ($1, $2, 'public', $3, $4, now() + make_interval(days => $5::int))
     RETURNING *`,
    [id, token, JSON.stringify(steps), first.ai ? 1 : 0, PUBLIC_TTL_DAYS],
  )).rows[0];

  waitUntil(reporter.notifyStarted().catch(() => {}));
  return res.status(200).json(clientState(brief, { aiEnabled: openai.isConfigured() }));
}

async function actionAnswer(req, res, body) {
  const token = String(body.token || '');
  if (!TOKEN_RE.test(token)) return fail(res, 404, 'not_found', 'Опрос не найден');

  // Шаг 1: под блокировкой записываем ответ. ИИ вызываем уже вне транзакции,
  // чтобы долгий запрос к модели не держал строку и соединение с базой.
  const saved = await transaction(async (client) => {
    const brief = (await client.query('SELECT * FROM briefs WHERE token = $1 FOR UPDATE', [token])).rows[0];
    if (!brief) return { error: [404, 'not_found', 'Опрос не найден'] };
    if (brief.status !== 'active' || isExpired(brief)) return { state: clientState(brief) };

    const steps = brief.steps || [];
    const index = Number(body.index);
    const current = steps[steps.length - 1];

    // Повторная отправка или устаревшая вкладка — просто отдаём актуальное состояние.
    if (brief.awaiting_contact || !current || current.answer || index !== steps.length - 1) {
      return { state: clientState(brief) };
    }

    const answer = engine.normalizeAnswer(current.question, body.answer);
    if (!answer) return { error: [400, 'invalid_answer', 'Выберите вариант или напишите ответ'] };

    steps[steps.length - 1] = { question: current.question, answer, progress: current.progress };
    await client.query(
      'UPDATE briefs SET steps = $2, last_activity_at = now() WHERE id = $1',
      [brief.id, JSON.stringify(steps)],
    );
    return { brief: { ...brief, steps } };
  });

  if (saved.error) return fail(res, ...saved.error);
  if (saved.state) return res.status(200).json(saved.state);

  const { brief } = saved;
  const steps = brief.steps;
  const lastProgress = steps[steps.length - 1].progress || 0;

  let next;
  if (brief.mode === 'owner') {
    next = engine.nextFromPlan(brief.plan, steps);
  } else if (brief.ai_calls >= MAX_AI_CALLS) {
    next = { done: true, progress: 100, ai: false };
  } else {
    next = await engine.nextAdaptive(steps, lastProgress);
  }

  // Шаг 2: добавляем следующий вопрос — только если за время генерации никто
  // не изменил опрос (вторая вкладка, двойной клик).
  const updated = await transaction(async (client) => {
    const fresh = (await client.query('SELECT * FROM briefs WHERE id = $1 FOR UPDATE', [brief.id])).rows[0];
    const freshSteps = fresh.steps || [];
    if (freshSteps.length !== steps.length || !freshSteps[freshSteps.length - 1].answer || fresh.awaiting_contact) {
      return fresh;
    }
    if (next.done) {
      return (await client.query(
        `UPDATE briefs SET awaiting_contact = true, last_activity_at = now(),
           ai_calls = ai_calls + $2 WHERE id = $1 RETURNING *`,
        [brief.id, next.ai ? 1 : 0],
      )).rows[0];
    }
    freshSteps.push({ question: next.question, answer: null, progress: next.progress });
    return (await client.query(
      `UPDATE briefs SET steps = $2, last_activity_at = now(), ai_calls = ai_calls + $3
        WHERE id = $1 RETURNING *`,
      [brief.id, JSON.stringify(freshSteps), next.ai ? 1 : 0],
    )).rows[0];
  });

  return res.status(200).json(clientState(updated));
}

async function actionBack(req, res, body) {
  const token = String(body.token || '');
  if (!TOKEN_RE.test(token)) return fail(res, 404, 'not_found', 'Опрос не найден');

  const state = await transaction(async (client) => {
    const brief = (await client.query('SELECT * FROM briefs WHERE token = $1 FOR UPDATE', [token])).rows[0];
    if (!brief) return null;
    if (brief.status !== 'active' || isExpired(brief)) return clientState(brief);

    const steps = brief.steps || [];
    if (!brief.awaiting_contact) {
      if (steps.length <= 1) return clientState(brief);
      // Текущий неотвеченный вопрос отбрасываем: после правки ответа следующий
      // вопрос будет сгенерирован заново уже с учётом изменения.
      steps.pop();
    }
    const previous = steps[steps.length - 1];
    if (!previous) return clientState(brief);
    steps[steps.length - 1] = {
      question: previous.question,
      answer: null,
      progress: previous.progress,
      draft_answer: previous.answer,
    };
    const updated = (await client.query(
      `UPDATE briefs SET steps = $2, awaiting_contact = false, last_activity_at = now()
        WHERE id = $1 RETURNING *`,
      [brief.id, JSON.stringify(steps)],
    )).rows[0];
    return clientState(updated);
  });

  if (!state) return fail(res, 404, 'not_found', 'Опрос не найден');
  return res.status(200).json(state);
}

async function actionComplete(req, res, body) {
  const token = String(body.token || '');
  if (!TOKEN_RE.test(token)) return fail(res, 404, 'not_found', 'Опрос не найден');
  if (!body.consent) return fail(res, 400, 'consent', 'Нужно согласие на обработку данных');

  const contact = body.contact || {};
  const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const name = clean(contact.name, 80);
  const channel = CHANNELS.includes(contact.channel) ? contact.channel : null;
  const value = clean(contact.value, 120);

  const locked = await transaction(async (client) => {
    const brief = (await client.query('SELECT * FROM briefs WHERE token = $1 FOR UPDATE', [token])).rows[0];
    if (!brief) return { error: [404, 'not_found', 'Опрос не найден'] };
    if (brief.status === 'completed') return { state: clientState(brief) };
    if (brief.status !== 'active' || isExpired(brief)) return { state: clientState(brief) };
    if (!brief.awaiting_contact) return { state: clientState(brief) };
    // В публичном опросе без контакта бриф бесполезен; по личной ссылке клиент
    // и так известен, поэтому контакт необязателен.
    if (brief.mode === 'public' && !value) return { error: [400, 'contact', 'Оставьте контакт, чтобы я мог ответить'] };
    return { brief };
  });

  if (locked.error) return fail(res, ...locked.error);
  if (locked.state) return res.status(200).json(locked.state);

  const { brief } = locked;
  const cases = await engine.matchCases(brief.steps, brief.mode === 'owner' ? brief.title || '' : '');

  const updated = (await query(
    `UPDATE briefs SET status = 'completed', completed_at = now(), last_activity_at = now(),
       client_name = $2, client_contact_channel = $3, client_contact = $4, cases = $5
      WHERE id = $1 AND status = 'active' RETURNING *`,
    [brief.id, name || null, value ? channel : null, value || null, JSON.stringify(cases)],
  )).rows[0];

  if (!updated) {
    const current = (await query('SELECT * FROM briefs WHERE id = $1', [brief.id])).rows[0];
    return res.status(200).json(clientState(current));
  }

  // Черновик ТЗ и PDF собираются в фоне: клиент не ждёт, а если что-то
  // сорвётся — фоновое обслуживание повторит отправку.
  waitUntil(reporter.sendReport(updated.id).catch((error) => log('отчёт:', error.message)));
  return res.status(200).json(clientState(updated));
}

/* ── Точка входа ─────────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!hasDatabase()) return fail(res, 503, 'unavailable', 'Сервис временно недоступен');

  try {
    if (req.method === 'GET') {
      if (req.query.action === 'load') return await actionLoad(req, res);
      return fail(res, 404, 'unknown_action', 'Неизвестное действие');
    }
    if (req.method !== 'POST') return fail(res, 405, 'method', 'Метод не поддерживается');

    let body;
    try {
      body = await readBody(req);
    } catch {
      return fail(res, 400, 'bad_request', 'Некорректный запрос');
    }

    switch (body.action) {
      case 'start': return await actionStart(req, res, body);
      case 'answer': return await actionAnswer(req, res, body);
      case 'back': return await actionBack(req, res, body);
      case 'complete': return await actionComplete(req, res, body);
      default: return fail(res, 404, 'unknown_action', 'Неизвестное действие');
    }
  } catch (error) {
    log('ошибка брифа:', error.message);
    return fail(res, 500, 'internal', 'Что-то пошло не так. Попробуйте ещё раз через минуту.');
  }
};
