'use strict';

const { config } = require('./lib/config');

/* Разовый служебный эндпоинт: подсказывает chat_id для уведомлений.
   Закрыт секретом cron. Удаляется сразу после настройки. */

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    res.status(401).json({ ok: false });
    return;
  }
  if (!config.botToken) { res.status(200).json({ ok: false, error: 'нет TELEGRAM_BOT_TOKEN' }); return; }

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/getUpdates`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    const chats = {};
    (data.result || []).forEach((update) => {
      const message = update.message || update.my_chat_member || update.channel_post || {};
      const chat = message.chat || {};
      if (chat.id) chats[chat.id] = { type: chat.type, name: chat.username || chat.first_name || chat.title };
    });
    res.status(200).json({ ok: data.ok, updates: (data.result || []).length, chats });
  } catch (error) {
    res.status(200).json({ ok: false, error: error.message });
  }
};
