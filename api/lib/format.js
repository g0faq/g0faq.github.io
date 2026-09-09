'use strict';

const { esc } = require('./telegram');

/* Сообщения для Telegram. Никакого сырого текста от посетителя здесь не
   появляется: только заранее заданные подписи вариантов анкеты, названия
   секций сайта и технические характеристики устройства. */

const MSK = 'Europe/Moscow';

/* Сообщения идут в один чат сплошным потоком, поэтому каждое обрамляется
   линейкой: иначе соседние уведомления читаются как одно. */
const RULE = '═══════════════════';

function time(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: MSK,
  }).format(date);
}

function duration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min < 1) return `${sec} сек`;
  if (min < 60) return `${min} мин ${String(sec).padStart(2, '0')} сек`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

function shortDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Человекочитаемый источник перехода. */
function referrerName(referrer, utmSource) {
  if (utmSource) return utmSource;
  if (!referrer) return 'прямой заход';
  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'неизвестно';
  }
  const known = [
    [/(^|\.)google\./, 'Google'],
    [/(^|\.)yandex\./, 'Яндекс'],
    [/(^|\.)t\.me$|telegram/, 'Telegram'],
    [/(^|\.)vk\.com$/, 'VK'],
    [/(^|\.)github\./, 'GitHub'],
    [/(^|\.)duckduckgo\./, 'DuckDuckGo'],
    [/(^|\.)bing\./, 'Bing'],
    [/(^|\.)profi\.ru$/, 'Profi.ru'],
  ];
  const hit = known.find(([pattern]) => pattern.test(host));
  return hit ? hit[1] : host;
}

const place = (session) => {
  const country = session.country || '';
  const city = session.city || '';
  if (country && city) return `${country}, ${city}`;
  if (country) return country;
  return 'не определено';
};

/** 👀 Новый посетитель. */
function visitMessage(session) {
  const device = [session.device_model, session.browser].filter(Boolean).join(' / ') || 'не определено';
  const screen = session.screen_w && session.screen_h
    ? `${session.screen_w}×${session.screen_h}`
    : 'не определено';

  return [
    RULE,
    session.is_new_visitor ? '👀 <b>НОВЫЙ ПОСЕТИТЕЛЬ</b>' : '🔁 <b>ВЕРНУЛСЯ ПОСЕТИТЕЛЬ</b>',
    RULE,
    '',
    `📍 ${esc(place(session))}`,
    `📱 ${esc(device)}${session.os ? ` · ${esc(session.os)}` : ''}`,
    `🔗 Источник: ${esc(session.referrer_name || 'прямой заход')}`,
    `🏠 Страница входа: ${esc(session.landing_page || '/')}`,
    `📺 Экран: ${esc(screen)}`,
    `🌐 Язык: ${esc(session.language || 'не определено')}`,
    '',
    `Visitor: #${esc(session.visitor_short)}`,
    `Session: #${esc(session.short_id)}`,
    '',
    RULE,
    time(),
  ].join('\n');
}

/** 👤 Пачка действий за окно буферизации. */
function activityMessage(session, pathItems, actions, seconds) {
  const lines = [RULE, `👤 <b>ДЕЙСТВИЯ · #${esc(session.visitor_short)}</b>`, RULE, ''];

  if (pathItems.length) {
    lines.push('<b>Путь:</b>');
    lines.push(pathItems.map((item, index) => (index ? `→ ${esc(item)}` : esc(item))).join('\n'));
    lines.push('');
  }

  if (actions.length) {
    lines.push('<b>Действия:</b>');
    lines.push(actions.map((item) => `• ${esc(item)}`).join('\n'));
    lines.push('');
  }

  lines.push(`⏱ На сайте: ${shortDuration(seconds)}`);
  lines.push(RULE);
  return lines.join('\n');
}

/** Строки с ответами калькулятора — общие для активности и итога. */
function calculatorLines(calc) {
  if (!calc) return [];
  const labels = calc.labels || {};
  const lines = [];
  const add = (title, value) => {
    if (!value) return;
    lines.push(`${title}: ${esc(Array.isArray(value) ? value.join(', ') : value)}`);
  };

  add('Проект', labels.product);
  add('Масштаб', labels.scale);
  add('Функции', labels.features);
  add('Дизайн', labels.design);
  add('Срок', labels.timeline);

  if (calc.price_min && calc.price_max) {
    const fmt = (n) => Number(n).toLocaleString('ru-RU');
    lines.push('');
    lines.push(`💰 Расчёт: ${fmt(calc.price_min)}–${fmt(calc.price_max)} ₽`);
  }
  return lines;
}

/** 🏁 Итог сессии. */
function summaryMessage(session, calc, pathItems) {
  const lines = [
    RULE,
    '🏁 <b>ПОСЕТИТЕЛЬ УШЁЛ</b>',
    RULE,
    '',
    `Visitor: #${esc(session.visitor_short)}`,
    '',
    `⏱ ${duration(session.duration_sec)}`,
    `📄 Страниц: ${session.pages_count || 1}`,
    `📜 Максимальный скролл: ${session.max_scroll || 0}%`,
    `📍 ${esc(place(session))} · ${esc(session.referrer_name || 'прямой заход')}`,
  ];

  if (pathItems.length) {
    lines.push('', '<b>Маршрут:</b>');
    lines.push(pathItems.map((item, index) => (index ? `→ ${esc(item)}` : esc(item))).join('\n'));
  }

  const calcLines = calculatorLines(calc);
  if (calcLines.length) {
    lines.push('', '<b>Калькулятор:</b>', ...calcLines);
    lines.push('');
    lines.push(calc.form_submitted ? '✅ Заявка отправлена' : '❌ Форму не отправил');
  }

  lines.push('', RULE, time());
  return lines.join('\n');
}

/** Немедленные уведомления о важных шагах. */
function importantMessage(session, kind, calc) {
  const head = `${RULE}\n⚡️ <b>#${esc(session.visitor_short)}</b>`;
  const titles = {
    calculator_open: '🧮 Открыл калькулятор',
    calculator_result: '💰 Получил расчёт стоимости',
    form_started: '✍️ Начал заполнять заявку',
    form_submitted: '🎉 <b>Отправил заявку</b>',
    form_abandoned: '🚪 Ушёл, не отправив заявку',
  };
  const lines = [head, RULE, '', titles[kind] || kind];
  const calcLines = calculatorLines(calc);
  if (calcLines.length) lines.push('', ...calcLines);
  lines.push('', RULE, time());
  return lines.join('\n');
}

module.exports = {
  visitMessage,
  activityMessage,
  summaryMessage,
  importantMessage,
  referrerName,
  duration,
  time,
};
