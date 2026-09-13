'use strict';

const crypto = require('node:crypto');
const { config, log } = require('./lib/config');
const { query, hasDatabase } = require('./lib/db');
const telegram = require('./lib/telegram');
const { esc } = telegram;

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
  '<code>/cancel</code> — отменить ввод имени',
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

async function onCallback(callback) {
  const data = String(callback.data || '');
  const chatId = String(callback.message?.chat?.id || '');
  if (chatId !== String(config.chatId)) return;

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
    `INSERT INTO bot_pending (chat_id, visitor_id) VALUES ($1, $2)
     ON CONFLICT (chat_id) DO UPDATE SET visitor_id = EXCLUDED.visitor_id, created_at = now()`,
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
    await reply('Ок, ввод имени отменён.');
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

  // Ожидаемый ответ после нажатия «Назвать».
  const pending = (await query(
    `SELECT v.id, v.short_id, v.name, v.sessions_count, v.last_seen_at
       FROM bot_pending p JOIN visitors v ON v.id = p.visitor_id
      WHERE p.chat_id = $1 AND p.created_at > now() - make_interval(mins => $2::int)`,
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
      { command: 'names', description: 'Подписанные посетители' },
      { command: 'name', description: 'Назвать: /name ECB7 Ольга' },
      { command: 'cancel', description: 'Отменить ввод имени' },
      { command: 'help', description: 'Как подписывать посетителей' },
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

  try {
    const update = req.body && typeof req.body === 'object' ? req.body : {};
    if (update.callback_query) await onCallback(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (error) {
    log('ошибка бота:', error.message);
  }
  res.status(200).json({ ok: true });
};
