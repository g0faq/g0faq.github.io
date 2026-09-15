'use strict';

const { log } = require('./config');
const { query } = require('./db');
const telegram = require('./telegram');
const engine = require('./brief-engine');
const { buildReport } = require('./brief-pdf');

const { esc } = telegram;

/* Всё, что опрос сообщает владельцу: PDF по завершении, отметки об открытии
 * и старте, сигнал о брошенном опросе. Отправка отчёта идемпотентна и
 * переживает сбои: если PDF не ушёл, фоновое обслуживание повторит попытку. */

const SITE = process.env.SITE_URL || 'https://g0faq.ru';
const linkFor = (token) => `${SITE}/brief.html?b=${encodeURIComponent(token)}`;

const MAX_REPORT_ATTEMPTS = 4;
const ABANDON_AFTER_MIN = 40;

const sourceLabel = (brief) => (brief.mode === 'owner'
  ? `по ссылке «${esc(brief.title || 'проект')}»`
  : 'на сайте · «Помощь с ТЗ»');

async function load(id) {
  return (await query('SELECT * FROM briefs WHERE id = $1', [id])).rows[0] || null;
}

/** Собрать черновик ТЗ, PDF и отправить владельцу. Безопасно вызывать повторно. */
async function sendReport(briefId) {
  const brief = await load(briefId);
  if (!brief || brief.status !== 'completed' || brief.report_sent) return false;

  try {
    let { draft } = brief;
    if (!draft) {
      draft = await engine.buildDraft(brief);
      if (draft) await query('UPDATE briefs SET draft = $2 WHERE id = $1', [brief.id, JSON.stringify(draft)]);
    }

    const pdf = await buildReport({ ...brief, draft });
    const answered = (brief.steps || []).filter((step) => step.answer).length;
    const caption = [
      '📋 <b>НОВЫЙ БРИФ</b>',
      '',
      `<b>${esc(draft?.project_title || brief.title || 'Проект')}</b>`,
      `Заполнен ${sourceLabel(brief)}`,
      `👤 ${esc(brief.client_name || 'имя не указано')}`,
      brief.client_contact ? `📨 ${esc(brief.client_contact_channel || 'контакт')}: ${esc(brief.client_contact)}` : '📨 контакт не оставлен',
      `✍️ Ответов: ${answered}${draft?.complexity ? ` · сложность ${esc(draft.complexity)}` : ''}`,
      draft ? '' : '\n⚠️ Черновик ТЗ не собран — ИИ был недоступен, в PDF только ответы.',
    ].filter((line) => line !== '').join('\n');

    const safeName = (draft?.project_title || brief.title || 'brief')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'brief';

    const result = await telegram.sendDocument(pdf, `brief-${safeName}.pdf`, caption);
    if (result.ok || result.skipped === 'disabled') {
      await query('UPDATE briefs SET report_sent = true WHERE id = $1', [brief.id]);
      return true;
    }
    throw new Error(result.error || result.skipped || 'telegram не принял документ');
  } catch (error) {
    log('отчёт по брифу не отправлен:', error.message);
    await query('UPDATE briefs SET report_attempts = report_attempts + 1 WHERE id = $1', [briefId]);
    return false;
  }
}

async function notifyOpened(brief) {
  await telegram.send([
    '👀 <b>КЛИЕНТ ОТКРЫЛ ОПРОС</b>',
    '',
    `«${esc(brief.title || 'проект')}»`,
    'Как заполнит — пришлю PDF с ответами и черновиком ТЗ.',
  ].join('\n'));
}

async function notifyStarted() {
  await telegram.send([
    '🧩 <b>НАЧАЛИ «ПОМОЩЬ С ТЗ»</b>',
    '',
    'Посетитель сайта начал отвечать на вопросы. Если дойдёт до конца — пришлю PDF, если бросит — короткую сводку.',
  ].join('\n'));
}

/** Фоновая часть: повтор неотправленных отчётов и сигнал о брошенных опросах. */
async function maintain() {
  const report = { reports: 0, abandoned: 0 };

  const unsent = (await query(
    `SELECT id FROM briefs
      WHERE status = 'completed' AND report_sent = false AND report_attempts < $1
        AND completed_at < now() - interval '2 minutes'
      ORDER BY completed_at ASC LIMIT 3`,
    [MAX_REPORT_ATTEMPTS],
  )).rows;
  for (const row of unsent) {
    if (await sendReport(row.id)) report.reports += 1;
  }

  const abandoned = (await query(
    `SELECT * FROM briefs
      WHERE status = 'active' AND abandon_notified = false
        AND jsonb_array_length(steps) >= 3
        AND last_activity_at < now() - make_interval(mins => $1::int)
      ORDER BY last_activity_at ASC LIMIT 5`,
    [ABANDON_AFTER_MIN],
  )).rows;

  for (const brief of abandoned) {
    const answered = (brief.steps || []).filter((step) => step.answer);
    if (answered.length < 2) {
      await query('UPDATE briefs SET abandon_notified = true WHERE id = $1', [brief.id]);
      continue;
    }
    const lines = answered.slice(0, 12).map((step) => (
      `• <b>${esc(step.question.title)}</b>\n   ${esc(engine.answerText(step.answer)).slice(0, 220)}`
    ));
    const result = await telegram.send([
      '🚪 <b>ОПРОС БРОШЕН</b>',
      '',
      `Источник: ${sourceLabel(brief)}`,
      `Остановился на вопросе ${answered.length + (brief.awaiting_contact ? 0 : 1)}${brief.awaiting_contact ? ' — не оставил контакты' : ''}`,
      '',
      ...lines,
      brief.mode === 'owner' ? `\nСсылка всё ещё работает: ${linkFor(brief.token)}` : '',
    ].join('\n'));
    if (result.ok || result.skipped) {
      await query('UPDATE briefs SET abandon_notified = true WHERE id = $1', [brief.id]);
      report.abandoned += 1;
    }
  }

  await query(`DELETE FROM brief_rate WHERE day < CURRENT_DATE - 1`);
  // Срок хранения, обещанный в политике: опросы старше года удаляются,
  // брошенные и просроченные — через месяц после окончания срока ссылки.
  await query(`DELETE FROM briefs WHERE created_at < now() - interval '365 days'`);
  await query(`DELETE FROM briefs WHERE status <> 'completed' AND expires_at < now() - interval '30 days'`);
  return report;
}

module.exports = { sendReport, notifyOpened, notifyStarted, maintain, linkFor };
