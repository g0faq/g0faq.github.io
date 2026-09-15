'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* Примерная стоимость по итогам опроса.
 *
 * Единственный источник цен — js/calculator-config.js, тот же файл, что
 * использует калькулятор на сайте: цены правятся в одном месте и не
 * расходятся. Формула повторяет calculateEstimate из js/calculator.js.
 *
 * Клиенту показывается осознанно низкая вилка: от нижней границы расчёта до
 * трети диапазона. Финальную цену называет исполнитель после обсуждения. */

const CONFIG_PATH = path.join(__dirname, '..', '..', 'js', 'calculator-config.js');

let cached = null;
function config() {
  if (cached) return cached;
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(CONFIG_PATH, 'utf8'), sandbox, { timeout: 1000 });
  cached = sandbox.window.CALCULATOR_CONFIG;
  return cached;
}

const byId = (items, id) => items.find((item) => item.id === id);
const roundTo = (value, step) => Math.round(value / step) * step;
const niceStep = (value) => (value < 100000 ? 1000 : 5000);

/** Та же формула, что и в калькуляторе на сайте. */
function calculate(selection) {
  const c = config();
  const product = byId(c.products, selection.product) || byId(c.products, 'custom');
  const scale = byId(c.scales, selection.scale) || byId(c.scales, 'small');
  const design = byId(c.designs, selection.design) || byId(c.designs, 'base');
  const timeline = byId(c.timelines, selection.timeline) || byId(c.timelines, 'standard');
  const features = [...new Set(selection.features || [])]
    .map((id) => byId(c.features, id))
    .filter((item) => item && !item.exclusive);

  const featureMin = features.reduce((sum, item) => sum + item.min, 0);
  const featureMax = features.reduce((sum, item) => sum + item.max, 0);
  const min = ((product.min * scale.minMultiplier) + featureMin + design.min) * timeline.minMultiplier;
  const max = ((product.max * scale.maxMultiplier) + featureMax + design.max) * timeline.maxMultiplier;

  return { product, scale, design, timeline, features, min, max };
}

/** Вилка для клиента: нижняя граница и треть диапазона сверху, красиво округлённые. */
function clientEstimate(selection) {
  const result = calculate(selection);
  const low = Math.max(5000, roundTo(result.min, niceStep(result.min)));
  const rawHigh = result.min + (result.max - result.min) * 0.33;
  let high = roundTo(rawHigh, niceStep(rawHigh));
  if (high <= low) high = low + niceStep(low) * 2;

  return {
    min: low,
    max: high,
    basis: {
      product: result.product.title,
      scale: result.scale.title,
      design: result.design.title,
      timeline: result.timeline.title,
      features: result.features.map((item) => item.title),
    },
  };
}

/** Перечень вариантов для инструкции модели. */
function catalogForPrompt() {
  const c = config();
  const list = (items) => items.map((item) => `${item.id} — ${item.title}`).join('; ');
  return [
    `product: ${list(c.products)}`,
    `scale: ${list(c.scales)}`,
    `features: ${list(c.features.filter((item) => !item.exclusive && item.id !== 'consultation'))}`,
    `design: ${list(c.designs)}`,
    `timeline: ${list(c.timelines)}`,
  ].join('\n');
}

/** JSON-схема разметки ответов по пунктам калькулятора. */
function selectionSchema() {
  const c = config();
  const ids = (items) => items.map((item) => item.id);
  return {
    type: 'object',
    additionalProperties: false,
    required: ['product', 'scale', 'features', 'design', 'timeline'],
    properties: {
      product: { type: 'string', enum: ids(c.products) },
      scale: { type: 'string', enum: ids(c.scales) },
      features: {
        type: 'array',
        items: { type: 'string', enum: ids(c.features.filter((item) => !item.exclusive && item.id !== 'consultation')) },
      },
      design: { type: 'string', enum: ids(c.designs) },
      timeline: { type: 'string', enum: ids(c.timelines) },
    },
  };
}

/* Разметка без ИИ. Сначала — явно выбранные варианты базового набора вопросов
   (там подписи известны заранее), и только если их нет — ключевые слова.
   Искать слова по всему тексту опасно: «каталог товаров» в списке функций
   не делает лендинг интернет-магазином. */

const LABELS = {
  product: {
    'Лендинг': 'landing',
    'Корпоративный сайт': 'corporate',
    'Интернет-магазин': 'store',
    'Telegram-бот или Mini App': 'telegram-bot',
    'CRM или личный кабинет': 'crm',
    'AI-автоматизация': 'ai',
  },
  features: {
    'Каталог товаров или услуг': 'catalog',
    'Онлайн-оплата': 'payment',
    'Личный кабинет': 'auth',
    'Админ-панель': 'admin',
    'Уведомления в Telegram': 'telegram',
    'CRM': 'api',
    '1С или склад': 'api',
    'Платёжная система': 'payment',
    'Доставка': 'delivery',
    'Google Таблицы': 'sheets',
  },
  design: {
    'Есть готовый макет': 'ready',
    'Есть фирменный стиль': 'base',
    'Нужен дизайн с нуля': 'individual',
    'Пока не думал': 'base',
  },
  timeline: {
    'Как можно скорее': 'faster',
  },
};

function guessSelection(steps, extraText = '') {
  const choices = (steps || [])
    .filter((step) => step.answer && !step.answer.skipped)
    .flatMap((step) => step.answer.choices || []);
  const pick = (map) => choices.map((label) => map[label]).filter(Boolean);

  const text = [
    extraText,
    ...(steps || []).map((step) => (step.answer ? `${step.answer.text || ''} ${step.answer.other || ''}` : '')),
  ].join(' ').toLowerCase();
  const has = (...words) => words.some((word) => text.includes(word));

  const product = pick(LABELS.product)[0]
    || (has('интернет-магазин', 'корзин') ? 'store'
      : has('mini app', 'мини-апп') ? 'mini-app'
        : has('бот') ? 'telegram-bot'
          : has('crm', 'личный кабинет') ? 'crm'
            : has('нейросет', 'автоматизац') ? 'ai'
              : has('лендинг', 'визитк', 'одностранич') ? 'landing'
                : 'corporate');

  const features = [...new Set(pick(LABELS.features))];
  const design = pick(LABELS.design)[0] || 'base';
  const timeline = pick(LABELS.timeline)[0] || 'standard';

  return { product, scale: 'small', features, design, timeline };
}

module.exports = { clientEstimate, catalogForPrompt, selectionSchema, guessSelection, calculate };
