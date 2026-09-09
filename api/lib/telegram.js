'use strict';

const { config, log } = require('./config');

/* Telegram ограничивает сообщение 4096 символами; режем с запасом и всегда
   помечаем обрезку, чтобы не гадать, всё ли пришло. */
const MAX_LENGTH = 3900;

function clamp(text) {
  if (text.length <= MAX_LENGTH) return text;
  return `${text.slice(0, MAX_LENGTH - 20)}\n…сообщение обрезано`;
}

/** Экранирование под parse_mode: HTML — единственный текст, который приходит
    от посетителя, это подписи вариантов анкеты, но экранируем всё подряд. */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Отправка сообщения. Никогда не бросает исключение наружу: падение Telegram
 * не должно ломать приём событий.
 */
async function send(text) {
  if (!config.telegramEnabled) {
    log('telegram отключён, сообщение не отправлено:\n' + text);
    return { ok: false, skipped: 'disabled' };
  }
  if (!config.botToken || !config.chatId) {
    log('нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return { ok: false, skipped: 'no-credentials' };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: clamp(text),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!data.ok) log('telegram отказал:', data.description || response.status);
    return { ok: Boolean(data.ok), error: data.description };
  } catch (error) {
    log('telegram недоступен:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { send, esc, clamp };
