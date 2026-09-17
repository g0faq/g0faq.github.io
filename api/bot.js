'use strict';

const crypto = require('node:crypto');
const { config, log } = require('./_lib/config');
const { query, hasDatabase } = require('./_lib/db');
const telegram = require('./_lib/telegram');
const { waitUntil } = require('@vercel/functions');
const engine = require('./_lib/brief-engine');
const { linkFor } = require('./_lib/brief-report');
const { esc } = telegram;

const OWNER_TTL_DAYS = Number(process.env.BRIEF_LINK_TTL_DAYS || 30);

/* Вебхук бота: владелец сайта подписывает посетителей именами.
 *
 * Способы задать имя:
 *   • кнопка «✏️ Назвать» под любым уведомлением → ответить именем;
 *   • ответить (reply) на уведомление, где есть #ECB7, просто текстом «Ольга»;
 *   • команда /name ECB7 Ольга.
 * Стереть имя — отправить «-» вместо имени.
 *
 * Принимаются только апдейты с секретным заголовком Telegram и только из
 * чата владельца (TELEGRAM_CHAT_ID) — чужие сообщения бот молча игнорирует. */

const PENDING_TTL_MIN = 15;
const MAX_NAME = 40;

/** Секрет вебхука выводится из CRON_SECRET: отдельная переменная не нужна. */
const webhookSecret = () => crypto
  .createHash('sha256')
  .update(`telegram-webhook:${config.cronSecret}`)
  .digest('hex')
  .slice(0, 48);

const HELP = [
  '🏷 <b>Имена посетителей</b>',
  '',
  'Нажмите «✏️ Назвать» под уведомлением и отправьте имя.',
  'Или ответьте на уведомление с <code>#ECB7</code> просто текстом: <i>Ольга</i>.',
  '',
  '<code>/name ECB7 Ольга</code> — назвать по коду',
  '<code>/name ECB7 -</code> — стереть имя',
  '<code>/names</code> — все подписанные посетители',
  '<code>/mute 83E3</code> — не уведомлять о визитах (свои устройства)',
  '<code>/unmute 83E3</code> — вернуть уведомления, <code>/mute</code> — список',
  '<code>/cancel</code> — отменить ввод',
  '',
  '📋 <b>Опросы для ТЗ</b>',
  '',
  '<code>/brief</code> — собрать опрос по ссылке: опишите проект, получите ссылку для клиента',
  '<code>/brief Интернет-магазин кофе, клиент Ольга…</code> — то же одной командой',
  '<code>/briefs</code> — последние опросы и их статус',
].join('\n');

const reply = (text, extra = {}) => telegram.api('sendMessage', {
  chat_id: config.chatId,
  text,
  parse_mode: 'HTML',
  disable_web_page_preview: true,
  ...extra,
});

/** Имя: одна строка без служебных символов, не длиннее MAX_NAME. */
const cleanName = (raw) => Array.from(String(raw || ''))
  .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
  .join('')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, MAX_NAME);

function when(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
  }).format(new Date(date));
}

/** Найти посетителя по короткому коду. Коды из 4 символов могут повторяться —
    тогда берём самого свежего и честно сообщаем об этом. */
async function findByShort(code) {
  const short = String(code || '').replace(/^#/, '').toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(short)) return { visitor: null, total: 0 };
  const rows = (await query(
    `SELECT id, short_id, name, sessions_count, last_seen_at
       FROM visitors WHERE short_id = $1 ORDER BY last_seen_at DESC LIMIT 5`,
    [short],
  )).rows;
  return { visitor: rows[0] || null, total: rows.length };
}

async function applyName(visitor, rawName, ambiguous) {
  const name = cleanName(rawName);
  await query('DELETE FROM bot_pending WHERE chat_id = $1', [config.chatId]);

  if (!name || name === '-') {
    await query('UPDATE visitors SET name = NULL, named_at = NULL WHERE id = $1', [visitor.id]);
    await reply(`🧹 У <b>#${esc(visitor.short_id)}</b> имя стёрто.`);
    return;
  }

  await query('UPDATE visitors SET name = $2, named_at = now() WHERE id = $1', [visitor.id, name]);
  const lines = [
    `✅ <b>#${esc(visitor.short_id)}</b> теперь — <b>${esc(name)}</b>`,
    `Визитов: ${visitor.sessions_count || 1} · последний: ${when(visitor.last_seen_at)}`,
    '',
    'Дальше в уведомлениях будет подписан по имени.',
  ];
  if (ambiguous) lines.push('', '⚠️ С этим кодом было несколько посетителей — подписан самый свежий.');
  await reply(lines.join('\n'));
}

/* ── Опросы по ссылке ────────────────────────────────────────────────────── */

const STATUS_ICON = { active: '🟢', completed: '✅', deleted: '🗑' };

function planPreview(brief, plan) {
  const questions = plan.questions || [];
  const list = questions.slice(0, 16).map((q, i) => `${i + 1}. ${esc(q.title)}`);
  return [
    '✅ <b>ОПРОС ГОТОВ</b>',
    '',
    `<b>«${esc(brief.title)}»</b>`,
    `Вопросов: ${questions.length}${plan.ai === false ? ' · ⚠️ базовый набор — ИИ недоступен' : ''}`,
    `Ссылка действует ${OWNER_TTL_DAYS} дней.`,
    '',
    brief.client_intro ? `<i>Клиент увидит: «${esc(brief.client_intro)}»</i>\n` : '',
    '<b>Вопросы:</b>',
    ...list,
  ].filter((line) => line !== '').join('\n');
}

const briefKeyboard = (brief) => ({
  inline_keyboard: [
    [{ text: '👁 Предпросмотр', url: `${linkFor(brief.token)}&preview=1` }],
    [
      { text: '♻️ Пересобрать', callback_data: `bp:regen:${brief.id}` },
      { text: '🗑 Удалить', callback_data: `bp:del:${brief.id}` },
    ],
  ],
});

async function sendBriefReady(brief, plan) {
  await reply(planPreview(brief, plan), { reply_markup: briefKeyboard(brief) });
  // Отдельное сообщение — чтобы его можно было сразу переслать клиенту.
  await telegram.api('sendMessage', {
    chat_id: config.chatId,
    text: `Здравствуйте! Подготовил опрос по вашему проекту: сначала опишете идею своими словами, дальше — уточняющие вопросы. Займёт 10–15 минут, а ответы помогут составить подробное техническое задание:\n${linkFor(brief.token)}`,
    disable_web_page_preview: true,
  });
}

async function createOwnerBrief(context) {
  const notes = String(context || '').trim();
  if (notes.length < 15) {
    await reply('Опишите проект подробнее — хотя бы пару предложений: что за бизнес, что нужно сделать, что уже известно.');
    return;
  }
  await query('DELETE FROM bot_pending WHERE chat_id = $1', [config.chatId]);
  await reply('⏳ Собираю опрос под этот проект — обычно до минуты…');

  const plan = await engine.planForOwner(notes);
  const brief = (await query(
    `INSERT INTO briefs (id, token, mode, title, client_intro, owner_context, plan, expires_at)
     VALUES ($1, $2, 'owner', $3, $4, $5, $6, now() + make_interval(days => $7::int))
     RETURNING *`,
    [crypto.randomUUID(), crypto.randomBytes(24).toString('base64url'), plan.title, plan.client_intro,
      notes.slice(0, engine.LIMITS.contextLen), JSON.stringify({ ai: plan.ai, questions: plan.questions }), OWNER_TTL_DAYS],
  )).rows[0];

  await sendBriefReady(brief, plan);
}

async function onBriefCallback(callback, data) {
  const [, action, id] = data.split(':');
  const ack = (text, alert = false) => telegram.api('answerCallbackQuery', {
    callback_query_id: callback.id, ...(text ? { text, show_alert: alert } : {}),
  });

  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { await ack(); return; }
  const brief = (await query("SELECT * FROM briefs WHERE id = $1 AND mode = 'owner'", [id])).rows[0];
  if (!brief) { await ack('Опрос не найден', true); return; }

  if (action === 'del') {
    if (brief.status === 'deleted') { await ack('Уже удалён'); return; }
    await query("UPDATE briefs SET status = 'deleted' WHERE id = $1", [id]);
    await ack('Удалён');
    await reply(`🗑 Опрос «${esc(brief.title)}» удалён — ссылка больше не открывается.`);
    return;
  }

  if (action === 'regen') {
    if (brief.status !== 'active') { await ack('Опрос уже завершён или удалён', true); return; }
    if ((brief.steps || []).length) { await ack('Клиент уже начал отвечать — пересобирать нельзя', true); return; }
    await ack('Пересобираю…');
    const plan = await engine.planForOwner(brief.owner_context);
    const updated = (await query(
      `UPDATE briefs SET title = $2, client_intro = $3, plan = $4 WHERE id = $1 AND jsonb_array_length(steps) = 0
       RETURNING *`,
      [id, plan.title, plan.client_intro, JSON.stringify({ ai: plan.ai, questions: plan.questions })],
    )).rows[0];
    if (!updated) { await reply('Клиент начал отвечать, пока я пересобирал, — оставил прежний вариант.'); return; }
    await sendBriefReady(updated, plan);
    return;
  }

  await ack();
}

async function listBriefs() {
  const rows = (await query(
    `SELECT id, token, mode, status, title, client_name, steps, created_at, completed_at, expires_at
       FROM briefs WHERE status <> 'deleted'
      ORDER BY created_at DESC LIMIT 15`,
  )).rows;
  if (!rows.length) { await reply('Опросов пока нет. Отправьте <code>/brief</code> и опишите проект.'); return; }

  const lines = rows.map((row) => {
    const answered = (row.steps || []).filter((step) => step.answer).length;
    const expired = row.status === 'active' && new Date(row.expires_at) < new Date();
    const icon = expired ? '⌛' : STATUS_ICON[row.status] || '•';
    const title = row.mode === 'owner' ? `«${esc(row.title || 'без названия')}»` : 'с сайта';
    const who = row.client_name ? ` · ${esc(row.client_name)}` : '';
    const state = row.status === 'completed'
      ? `заполнен ${when(row.completed_at)}`
      : expired ? 'ссылка истекла' : answered ? `ответов: ${answered}` : 'не начат';
    const link = row.mode === 'owner' && row.status === 'active' && !expired
      ? `\n   ${linkFor(row.token)}` : '';
    return `${icon} ${title}${who} — ${state}${link}`;
  });
  await reply(['📋 <b>Последние опросы</b>', '', ...lines].join('\n'));
}

async function onCallback(callback) {
  const data = String(callback.data || '');
  const chatId = String(callback.message?.chat?.id || '');
  if (chatId !== String(config.chatId)) return;

  if (data.startsWith('bp:')) { await onBriefCallback(callback, data); return; }

  if (!data.startsWith('nm:')) {
    await telegram.api('answerCallbackQuery', { callback_query_id: callback.id });
    return;
  }

  const visitorId = data.slice(3);
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) {
    await telegram.api('answerCallbackQuery', { callback_query_id: callback.id });
    return;
  }

  const visitor = (await query(
    'SELECT id, short_id, name FROM visitors WHERE id = $1', [visitorId],
  )).rows[0];

  if (!visitor) {
    await telegram.api('answerCallbackQuery', {
      callback_query_id: callback.id,
      text: 'Посетитель не найден — возможно, данные уже удалены',
      show_alert: true,
    });
    return;
  }

  await query(
    `INSERT INTO bot_pending (chat_id, visitor_id, kind) VALUES ($1, $2, 'name')
     ON CONFLICT (chat_id) DO UPDATE SET visitor_id = EXCLUDED.visitor_id, kind = 'name', created_at = now()`,
    [config.chatId, visitor.id],
  );
  await telegram.api('answerCallbackQuery', { callback_query_id: callback.id });

  const current = visitor.name
    ? `\nСейчас: <b>${esc(visitor.name)}</b>. Отправьте «-», чтобы стереть.`
    : '';
  await reply(`✏️ Как назвать посетителя <b>#${esc(visitor.short_id)}</b>?${current}`, {
    reply_markup: { force_reply: true, input_field_placeholder: 'Например: Ольга, клиент с Profi' },
  });
}

async function onMessage(message) {
  if (String(message.chat?.id) !== String(config.chatId)) return;
  const text = String(message.text || '').trim();
  if (!text) return;

  if (/^\/(start|help)\b/.test(text)) { await reply(HELP); return; }

  if (/^\/cancel\b/.test(text)) {
    await query('DELETE FROM bot_pending WHERE chat_id = $1', [config.chatId]);
    await reply('Ок, ввод отменён.');
    return;
  }

  if (/^\/briefs\b/.test(text)) { await listBriefs(); return; }

  const briefCommand = text.match(/^\/brief(?:@\w+)?(?:\s+([\s\S]+))?$/);
  if (briefCommand) {
    if (briefCommand[1]) { await createOwnerBrief(briefCommand[1]); return; }
    await query(
      `INSERT INTO bot_pending (chat_id, visitor_id, kind) VALUES ($1, NULL, 'brief')
       ON CONFLICT (chat_id) DO UPDATE SET visitor_id = NULL, kind = 'brief', created_at = now()`,
      [config.chatId],
    );
    await reply([
      '📋 <b>Новый опрос для клиента</b>',
      '',
      'Опишите проект одним сообщением — всё, что уже знаете:',
      '• что за бизнес и кто клиент;',
      '• что нужно сделать;',
      '• что уже известно: функции, сроки, бюджет, ориентиры;',
      '• что хотите уточнить у клиента.',
      '',
      'Заметки видите только вы: клиенту попадут лишь вопросы.',
    ].join('\n'), {
      reply_markup: { force_reply: true, input_field_placeholder: 'Например: кофейня, нужен сайт с меню и доставкой…' },
    });
    return;
  }

  if (/^\/names\b/.test(text)) {
    const rows = (await query(
      `SELECT short_id, name, sessions_count, last_seen_at
         FROM visitors WHERE name IS NOT NULL ORDER BY last_seen_at DESC LIMIT 40`,
    )).rows;
    if (!rows.length) {
      await reply('Пока никто не подписан. Нажмите «✏️ Назвать» под уведомлением.');
      return;
    }
    const list = rows.map((r) => (
      `• <b>${esc(r.name)}</b> — #${esc(r.short_id)} · визитов ${r.sessions_count} · ${when(r.last_seen_at)}`
    ));
    await reply(['🏷 <b>Подписанные посетители</b>', '', ...list].join('\n'));
    return;
  }

  // Свои устройства: /mute 83E3 — визиты не уведомляют, /unmute — вернуть.
  const mute = text.match(/^\/(mute|unmute)(?:@\w+)?(?:\s+#?([0-9a-fA-F]{4}))?\s*$/);
  if (mute) {
    if (!mute[2]) {
      const rows = (await query(
        `SELECT short_id, name, last_seen_at FROM visitors WHERE muted ORDER BY last_seen_at DESC LIMIT 40`,
      )).rows;
      const list = rows.length
        ? rows.map((r) => `• #${esc(r.short_id)}${r.name ? ` — ${esc(r.name)}` : ''} · ${when(r.last_seen_at)}`)
        : ['пока никого'];
      await reply(['🔕 <b>Без уведомлений</b>', '', ...list, '', 'Формат: <code>/mute 83E3</code> или <code>/unmute 83E3</code>'].join('\n'));
      return;
    }
    const { visitor, total } = await findByShort(mute[2]);
    if (!visitor) {
      await reply(`Посетитель <b>#${esc(mute[2].toUpperCase())}</b> не найден.`);
      return;
    }
    const on = mute[1] === 'mute';
    await query('UPDATE visitors SET muted = $2 WHERE id = $1', [visitor.id, on]);
    const lines = [on
      ? `🔕 <b>#${esc(visitor.short_id)}</b> — уведомлений о визитах больше не будет. Статистика пишется.`
      : `🔔 <b>#${esc(visitor.short_id)}</b> — уведомления снова включены.`];
    if (total > 1) lines.push('', '⚠️ С этим кодом было несколько посетителей — изменён самый свежий.');
    await reply(lines.join('\n'));
    return;
  }

  const command = text.match(/^\/name(?:@\w+)?\s+#?([0-9a-fA-F]{4})\s+(.+)$/s);
  if (command) {
    const { visitor, total } = await findByShort(command[1]);
    if (!visitor) {
      await reply(`Посетитель <b>#${esc(command[1].toUpperCase())}</b> не найден.`);
      return;
    }
    await applyName(visitor, command[2], total > 1);
    return;
  }
  if (/^\/name\b/.test(text)) { await reply('Формат: <code>/name ECB7 Ольга</code>'); return; }
  if (text.startsWith('/')) { await reply(HELP); return; }

  // Ожидаемое описание проекта после /brief.
  const briefPending = (await query(
    `SELECT 1 FROM bot_pending
      WHERE chat_id = $1 AND kind = 'brief' AND created_at > now() - make_interval(mins => $2::int)`,
    [config.chatId, PENDING_TTL_MIN * 2],
  )).rows[0];
  if (briefPending) { await createOwnerBrief(text); return; }

  // Ожидаемый ответ после нажатия «Назвать».
  const pending = (await query(
    `SELECT v.id, v.short_id, v.name, v.sessions_count, v.last_seen_at
       FROM bot_pending p JOIN visitors v ON v.id = p.visitor_id
      WHERE p.chat_id = $1 AND p.kind = 'name'
        AND p.created_at > now() - make_interval(mins => $2::int)`,
    [config.chatId, PENDING_TTL_MIN],
  )).rows[0];
  if (pending) { await applyName(pending, text, false); return; }

  // Ответ на любое уведомление: берём код посетителя из цитируемого сообщения.
  const quoted = String(message.reply_to_message?.text || '');
  const code = quoted.match(/#([0-9A-F]{4})\b/);
  if (code) {
    const { visitor, total } = await findByShort(code[1]);
    if (visitor) { await applyName(visitor, text, total > 1); return; }
  }

  await reply(HELP);
}

/** Однократная настройка: регистрирует вебхук и меню команд. */
async function setup(req, res) {
  const auth = req.headers.authorization || '';
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    res.status(401).json({ ok: false });
    return;
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `https://${host}/api/bot`;
  const hook = await telegram.api('setWebhook', {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  const commands = await telegram.api('setMyCommands', {
    commands: [
      { command: 'brief', description: 'Собрать опрос для клиента' },
      { command: 'briefs', description: 'Последние опросы' },
      { command: 'names', description: 'Подписанные посетители' },
      { command: 'name', description: 'Назвать: /name ECB7 Ольга' },
      { command: 'mute', description: 'Не уведомлять о своих визитах: /mute 83E3' },
      { command: 'unmute', description: 'Вернуть уведомления: /unmute 83E3' },
      { command: 'cancel', description: 'Отменить ввод' },
      { command: 'help', description: 'Что умеет бот' },
    ],
  });
  res.status(200).json({ ok: Boolean(hook.ok), url, webhook: hook.description, commands: commands.ok });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') { await setup(req, res); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }

  if (req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret()) {
    res.status(401).json({ ok: false });
    return;
  }

  // Telegram повторяет всё, на что не получил 200, — отвечаем 200 всегда.
  if (!hasDatabase()) { res.status(200).json({ ok: true }); return; }

  // Отвечаем Telegram сразу, а работу продолжаем в фоне: генерация опроса
  // занимает десятки секунд, и без этого Telegram слал бы апдейт повторно.
  const update = req.body && typeof req.body === 'object' ? req.body : {};
  const work = (async () => {
    try {
      if (update.callback_query) await onCallback(update.callback_query);
      else if (update.message) await onMessage(update.message);
    } catch (error) {
      log('ошибка бота:', error.message);
      await reply('⚠️ Не получилось выполнить команду. Попробуйте ещё раз через минуту.').catch(() => {});
    }
  })();
  waitUntil(work);
  res.status(200).json({ ok: true });
};
