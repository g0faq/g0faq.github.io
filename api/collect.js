'use strict';

const { config, log } = require('./lib/config');
const { query, transaction, hasDatabase } = require('./lib/db');
const { fromHeaders } = require('./lib/geo');
const telegram = require('./lib/telegram');
const format = require('./lib/format');
const { runMaintenance } = require('./lib/tasks');

/* Единственная точка приёма событий с сайта.
 *
 * Договор с фронтендом: один POST на пачку событий. Ответ всегда быстрый и
 * всегда 2xx для валидных запросов — сайт не должен зависеть от того, жив ли
 * бэкенд. Ошибки логируются, но наружу не выносятся. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Белый список типов: всё, чего здесь нет, отбрасывается. */
const EVENT_TYPES = new Set([
  'session_start', 'page_view', 'page_leave', 'section_view', 'scroll_depth',
  'cta_click', 'case_open', 'contact_click', 'outbound_click',
  'calculator_open', 'calculator_step_view', 'calculator_option_selected',
  'calculator_option_changed', 'calculator_back', 'calculator_next',
  'calculated_price_changed', 'form_started', 'form_completed',
  'form_submitted', 'form_abandoned', 'session_end',
]);

/** Эти события уходят в Telegram сразу, не дожидаясь окна буферизации. */
const IMPORTANT = new Set([
  'calculator_open', 'calculated_price_changed', 'form_started',
  'form_submitted', 'form_abandoned',
]);

const DEVICES = new Set(['desktop', 'mobile', 'tablet']);
const MAX_EVENTS_PER_REQUEST = 60;
const MAX_EVENTS_PER_SESSION = 800;
const BOT_UA = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python-requests|axios|scrapy|semrush|ahrefs|yandexbot|googlebot/i;

const str = (value, max = 300) => (typeof value === 'string' ? value.slice(0, max) : null);
const int = (value, max = 100000) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : null;
};

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // 256 КБ — заведомо больше любой честной пачки событий.
    if (size > 262144) throw new Error('payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Заводим посетителя и сессию, если их ещё нет. Возвращаем состояние сессии. */
async function ensureSession(client, payload, geo, isBot) {
  const ctx = payload.ctx || {};
  const utm = ctx.utm || {};
  const referrerName = format.referrerName(ctx.referrer, utm.source);

  await client.query(
    `INSERT INTO visitors (id, short_id, first_referrer, first_utm_source, first_landing, country, city)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE
       SET last_seen_at = now(),
           country = COALESCE(visitors.country, EXCLUDED.country),
           city = COALESCE(visitors.city, EXCLUDED.city)`,
    [payload.visitor_id, payload.visitor_short, str(ctx.referrer, 500),
      str(utm.source, 120), str(ctx.landing, 300), geo.country, geo.city],
  );

  const existing = await client.query('SELECT * FROM sessions WHERE id = $1', [payload.session_id]);
  if (existing.rows.length) return { session: existing.rows[0], created: false };

  const visitor = await client.query(
    'SELECT sessions_count FROM visitors WHERE id = $1', [payload.visitor_id],
  );
  const isNew = (visitor.rows[0]?.sessions_count || 0) === 0;

  await client.query(
    'UPDATE visitors SET sessions_count = sessions_count + 1 WHERE id = $1',
    [payload.visitor_id],
  );

  const screen = ctx.screen || {};
  const inserted = await client.query(
    `INSERT INTO sessions (
       id, visitor_id, short_id, is_new_visitor, landing_page, exit_page,
       referrer, referrer_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       device_type, device_model, os, browser, screen_w, screen_h, language, timezone,
       country, city, is_bot
     ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING *`,
    [
      payload.session_id, payload.visitor_id, payload.session_short, isNew,
      str(ctx.landing, 300), str(ctx.referrer, 500), str(referrerName, 120),
      str(utm.source, 120), str(utm.medium, 120), str(utm.campaign, 200),
      str(utm.content, 200), str(utm.term, 200),
      DEVICES.has(ctx.device) ? ctx.device : null,
      str(ctx.model, 60), str(ctx.os, 60), str(ctx.browser, 60),
      int(screen.w, 20000), int(screen.h, 20000),
      str(ctx.language, 20), str(ctx.timezone, 60),
      geo.country, geo.city, isBot,
    ],
  );

  return { session: inserted.rows[0], created: true };
}

/** Обновляем состояние калькулятора: одна строка на сессию, всегда актуальная. */
async function saveCalculator(client, payload, event) {
  const data = event.calc || {};
  const answers = data.answers && typeof data.answers === 'object' ? data.answers : {};
  const labels = data.labels && typeof data.labels === 'object' ? data.labels : {};

  await client.query(
    `INSERT INTO calculator_states (
       session_id, visitor_id, step, max_step, reached_result,
       answers, labels, price_min, price_max, form_started, form_submitted, form_fields
     ) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (session_id) DO UPDATE SET
       updated_at = now(),
       step = EXCLUDED.step,
       max_step = GREATEST(calculator_states.max_step, EXCLUDED.step),
       reached_result = calculator_states.reached_result OR EXCLUDED.reached_result,
       answers = EXCLUDED.answers,
       labels = EXCLUDED.labels,
       price_min = COALESCE(EXCLUDED.price_min, calculator_states.price_min),
       price_max = COALESCE(EXCLUDED.price_max, calculator_states.price_max),
       form_started = calculator_states.form_started OR EXCLUDED.form_started,
       form_submitted = calculator_states.form_submitted OR EXCLUDED.form_submitted,
       form_fields = CASE
         WHEN EXCLUDED.form_fields = '{}'::jsonb THEN calculator_states.form_fields
         ELSE EXCLUDED.form_fields END`,
    [
      payload.session_id, payload.visitor_id,
      int(data.step, 20), Boolean(data.result),
      JSON.stringify(answers), JSON.stringify(labels),
      int(data.price_min, 100000000), int(data.price_max, 100000000),
      Boolean(data.form_started), Boolean(data.form_submitted),
      JSON.stringify(data.form_fields && typeof data.form_fields === 'object' ? data.form_fields : {}),
    ],
  );
}

async function calculatorState(sessionId) {
  const result = await query('SELECT * FROM calculator_states WHERE session_id = $1', [sessionId]);
  return result.rows[0] || null;
}

/** Ставим уведомление в очередь. dedupe_key не даёт дублей при повторных отправках. */
async function enqueue(client, { sessionId, kind, dedupeKey, text, delaySec = 0 }) {
  await client.query(
    `INSERT INTO notifications (session_id, kind, dedupe_key, text, send_after)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5::int))
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    [sessionId, kind, dedupeKey || null, text, delaySec],
  );
}

module.exports = async function handler(req, res) {
  cors(req, res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  if (!config.analyticsEnabled) { res.status(200).json({ ok: true, disabled: true }); return; }

  let payload;
  try {
    payload = await readBody(req);
  } catch (error) {
    res.status(400).json({ ok: false });
    return;
  }

  if (!UUID.test(payload.visitor_id || '') || !UUID.test(payload.session_id || '')) {
    res.status(400).json({ ok: false });
    return;
  }

  const events = Array.isArray(payload.events)
    ? payload.events.filter((item) => item && EVENT_TYPES.has(item.type)).slice(0, MAX_EVENTS_PER_REQUEST)
    : [];

  if (!hasDatabase()) {
    log('база не настроена, событий принято:', events.length);
    res.status(200).json({ ok: true, stored: false });
    return;
  }

  const geo = fromHeaders(req.headers);
  const isBot = BOT_UA.test(req.headers['user-agent'] || '');

  try {
    const outcome = await transaction(async (client) => {
      const { session, created } = await ensureSession(client, payload, geo, isBot);

      // Ботов записываем, но ничего о них не шлём: Telegram не должен звенеть
      // на каждый обход поисковика.
      const notify = !session.is_bot && !isBot;
      const important = [];

      if (session.events_count >= MAX_EVENTS_PER_SESSION) {
        return { session, notify: false, created: false, important };
      }

      const pathItems = Array.isArray(session.path) ? session.path.slice() : [];
      let pages = session.pages_count;
      let maxScroll = session.max_scroll;
      let exitPage = session.exit_page;
      let ended = false;

      for (const event of events) {
        const payloadJson = event.data && typeof event.data === 'object' ? event.data : {};

        await client.query(
          `INSERT INTO events (session_id, visitor_id, offset_ms, type, payload)
           VALUES ($1, $2, $3, $4, $5)`,
          [payload.session_id, payload.visitor_id, int(event.t, 86400000), event.type,
            JSON.stringify(payloadJson)],
        );

        if (event.type === 'page_view') {
          pages += 1;
          exitPage = str(payloadJson.path, 300) || exitPage;
          const title = str(payloadJson.title, 80);
          if (title && pathItems[pathItems.length - 1] !== title) pathItems.push(title);
        }

        if (event.type === 'section_view') {
          const title = str(payloadJson.name, 80);
          if (title && pathItems[pathItems.length - 1] !== title) pathItems.push(title);
        }

        if (event.type === 'scroll_depth') {
          maxScroll = Math.max(maxScroll, int(payloadJson.depth, 100) || 0);
        }

        if (event.calc) await saveCalculator(client, payload, event);

        if (IMPORTANT.has(event.type)) important.push(event.type);
        if (event.type === 'session_end') ended = true;
      }

      await client.query(
        `UPDATE sessions SET
           last_event_at = now(),
           events_count = events_count + $2,
           pages_count = $3,
           max_scroll = $4,
           exit_page = $5,
           path = $6,
           duration_sec = GREATEST(duration_sec, $7),
           ended_at = CASE WHEN $8 THEN now() ELSE ended_at END,
           end_reason = CASE WHEN $8 THEN 'client' ELSE end_reason END
         WHERE id = $1`,
        [payload.session_id, events.length, pages, maxScroll, exitPage,
          JSON.stringify(pathItems.slice(-30)), int(payload.duration_sec, 86400) || 0, ended],
      );

      // Уведомление о заходе — один раз на сессию.
      if (created && notify) {
        const visitor = await client.query('SELECT short_id FROM visitors WHERE id = $1', [payload.visitor_id]);
        const view = { ...session, visitor_short: visitor.rows[0]?.short_id || '????' };
        await enqueue(client, {
          sessionId: session.id,
          kind: 'visit',
          dedupeKey: `visit:${session.id}`,
          text: format.visitMessage(view),
        });
      }

      // Пачка обычных действий: одно сообщение на окно, а не на каждое событие.
      if (notify && events.length && !created) {
        const bucket = Math.floor(Date.now() / (config.activityWindowSec * 1000));
        await enqueue(client, {
          sessionId: session.id,
          kind: 'activity',
          dedupeKey: `activity:${session.id}:${bucket}`,
          text: '',
          delaySec: config.activityWindowSec,
        });
      }

      return { session, notify, important, ended };
    });

    // Важные шаги отправляем сразу, вне транзакции: медленный Telegram не
    // должен держать открытым соединение с базой.
    if (outcome.notify && outcome.important.length) {
      const calc = await calculatorState(payload.session_id);
      const visitor = await query('SELECT short_id FROM visitors WHERE id = $1', [payload.visitor_id]);
      const view = { ...outcome.session, visitor_short: visitor.rows[0]?.short_id || '????' };
      const unique = [...new Set(outcome.important)];
      for (const kind of unique) {
        const key = `important:${payload.session_id}:${kind}`;
        const reserved = await query(
          `INSERT INTO notifications (session_id, kind, dedupe_key, text, sent_at)
           VALUES ($1, 'important', $2, $3, now())
           ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
           RETURNING id`,
          [payload.session_id, key, kind],
        );
        if (!reserved.rows.length) continue;
        const mapped = kind === 'calculated_price_changed' ? 'calculator_result' : kind;
        await telegram.send(format.importantMessage(view, mapped, calc));
      }
    }
  } catch (error) {
    // Аналитика не имеет права ломать сайт: логируем и отвечаем успехом.
    // Текст ошибки возвращаем только в режиме отладки — наружу он не нужен.
    log('ошибка приёма:', error.message);
    res.status(200).json({ ok: true, stored: false, ...(config.debug ? { error: error.message } : {}) });
    return;
  }

  res.status(200).json({ ok: true });

  // Обслуживание запускаем уже после ответа: буфер уведомлений и закрытие
  // сессий по таймауту не должны задерживать клиента.
  runMaintenance({ minIntervalSec: 25 }).catch((error) => log('обслуживание не прошло:', error.message));
};
