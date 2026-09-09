'use strict';

/** Настройки читаются из переменных окружения — в коде секретов нет. */

const flag = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
};

const config = {
  analyticsEnabled: flag('ANALYTICS_ENABLED', true),
  telegramEnabled: flag('TELEGRAM_NOTIFICATIONS_ENABLED', true),
  debug: flag('ANALYTICS_DEBUG', false),

  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',

  eventRetentionDays: Number(process.env.ANALYTICS_EVENT_RETENTION_DAYS || 90),
  cronSecret: process.env.CRON_SECRET || '',

  allowedOrigins: (process.env.ALLOWED_ORIGINS
    || 'https://g0faq.ru,https://www.g0faq.ru,https://g0faq.github.io')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),

  /** Сессия считается закрытой, если событий не было столько минут. */
  sessionTimeoutMin: 20,
  /** Не чаще одного сообщения об активности на сессию за столько секунд. */
  activityWindowSec: 20,
};

const log = (...args) => {
  if (config.debug) console.log('[analytics]', ...args);
};

module.exports = { config, log };
