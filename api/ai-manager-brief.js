'use strict';

const { config, log } = require('./_lib/config');
const telegram = require('./_lib/telegram');

/* Приём анкеты со страницы /brief/ai-manager/ и пересылка в Telegram.
 *
 *   POST { contact, sections: [{ title, items: [{ question, answer }] }] }
 *
 * Ответы группируются по разделам. Если текст не помещается в одно
 * сообщение, он уходит частями с пометкой (1/3), (2/3)… через общий
 * telegram.send — токен и чат берутся из тех же переменных окружения. */

const TITLE = '📝 Бриф: AI-менеджер';
// telegram.send обрезает после 3900 символов — оставляем запас на заголовок части.
const PART_LIMIT = 3700;

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

const text = (value, max) => String(value == null ? '' : value).trim().slice(0, max);

/** Блоки сообщения: шапка и по одному блоку на раздел. */
function blocks(body) {
  const contact = text(body.contact, 200);
  const head = `Контакт: ${telegram.esc(contact || 'не указан')}`;
  const sections = (Array.isArray(body.sections) ? body.sections : []).slice(0, 30).map((section) => {
    const items = (Array.isArray(section && section.items) ? section.items : []).slice(0, 40);
    const lines = items.map((item) => {
      const answer = text(item && item.answer, 3000) || '—';
      return `• ${telegram.esc(text(item && item.question, 300))}: ${telegram.esc(answer)}`;
    });
    return [`<b>${telegram.esc(text(section && section.title, 120))}</b>`, ...lines].join('\n');
  });
  return [head, ...sections];
}

/** Раскладка блоков по сообщениям; слишком длинный блок режется по строкам. */
function pack(parts) {
  const messages = [];
  let current = '';
  const push = (piece) => {
    if (current && current.length + piece.length + 2 > PART_LIMIT) {
      messages.push(current);
      current = '';
    }
    while (piece.length > PART_LIMIT) {
      messages.push(piece.slice(0, PART_LIMIT));
      piece = piece.slice(PART_LIMIT);
    }
    current = current ? `${current}\n\n${piece}` : piece;
  };
  for (const block of parts) {
    if (block.length <= PART_LIMIT) push(block);
    else block.split('\n').forEach(push);
  }
  if (current) messages.push(current);
  return messages;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Метод не поддерживается' });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return res.status(400).json({ ok: false, message: 'Некорректный запрос' });
  }
  if (!body || !Array.isArray(body.sections) || body.sections.length === 0) {
    return res.status(400).json({ ok: false, message: 'Нет ответов анкеты' });
  }

  const messages = pack(blocks(body));
  const total = messages.length;
  for (let i = 0; i < total; i++) {
    const header = total > 1 ? `${TITLE} (${i + 1}/${total})` : TITLE;
    const result = await telegram.send(`${header}\n\n${messages[i]}`);
    if (!result.ok) {
      log('бриф AI-менеджера не отправлен:', result.error || result.skipped);
      return res.status(502).json({ ok: false, message: 'Не удалось отправить ответы. Попробуйте ещё раз или скопируйте их текстом.' });
    }
  }
  return res.status(200).json({ ok: true, parts: total });
};
