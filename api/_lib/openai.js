'use strict';

const { log } = require('./config');

/* Минимальный клиент OpenAI без SDK: один запрос Chat Completions со строгой
 * JSON-схемой ответа. Модель ни при каких условиях не может вернуть свободный
 * текст — только объект заданной формы, который дальше ещё и валидируется.
 *
 * Модель задаётся OPENAI_MODEL. Для семейства gpt-5 и o-серии передаётся
 * reasoning_effort; если конкретная модель его не принимает, запрос
 * автоматически повторяется без этого параметра. */

const API_URL = 'https://api.openai.com/v1/chat/completions';

/* Две модели: быстрая и дешёвая — на каждый вопрос опроса и подбор кейсов,
   умнее — на черновик ТЗ, который собирается в фоне и где скорость не важна. */
const settings = () => ({
  key: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
  draftModel: process.env.OPENAI_MODEL_DRAFT || 'gpt-5.6-terra',
});

const isConfigured = () => Boolean(settings().key);

const supportsReasoning = (model) => /^(gpt-5|gpt-6|o\d)/.test(model);

/* У моделей новее gpt-5 нет уровня minimal — самый быстрый там none. */
const effortFor = (model, effort) => (effort === 'minimal' && /^gpt-(5\.\d|6)/.test(model) ? 'none' : effort);

class OpenAIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {object} p
 * @param {string} p.system   — системная инструкция
 * @param {string} p.user     — данные задачи (ответы клиента передаются как данные)
 * @param {string} p.name     — имя схемы
 * @param {object} p.schema   — JSON Schema (strict)
 * @param {'minimal'|'low'|'medium'} [p.effort]
 * @param {number} [p.maxTokens]
 * @param {number} [p.timeoutMs]
 */
async function structured({ system, user, name, schema, effort = 'low', maxTokens = 4000, timeoutMs = 60000, quality = 'fast' }) {
  const { key, model: fastModel, draftModel } = settings();
  const model = quality === 'draft' ? draftModel : fastModel;
  if (!key) throw new OpenAIError('OPENAI_API_KEY не задан', 0);

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name, strict: true, schema },
    },
    max_completion_tokens: maxTokens,
  };
  if (supportsReasoning(model)) body.reasoning_effort = effortFor(model, effort);

  const call = async (payload) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  let { response, data } = await call(body);

  // Модель не знает reasoning_effort — повторяем без него, а не падаем.
  if (!response.ok && body.reasoning_effort && /reasoning/i.test(data?.error?.message || '')) {
    delete body.reasoning_effort;
    ({ response, data } = await call(body));
  }

  if (!response.ok) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    log('openai отказал:', message);
    throw new OpenAIError(message, response.status);
  }

  const choice = data.choices && data.choices[0];
  if (choice?.message?.refusal) throw new OpenAIError('Модель отказалась отвечать', 422);
  if (choice?.finish_reason === 'length') throw new OpenAIError('Ответ модели обрезан по длине', 422);

  try {
    return JSON.parse(choice.message.content);
  } catch {
    throw new OpenAIError('Модель вернула не JSON', 422);
  }
}

module.exports = { structured, isConfigured, OpenAIError, settings };
