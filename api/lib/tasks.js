'use strict';

const { config, log } = require('./config');
const { query } = require('./db');
const telegram = require('./telegram');
const format = require('./format');

/* Фоновое обслуживание аналитики:
 *   1. отправить накопившиеся уведомления об активности;
 *   2. закрыть сессии, по которым давно нет событий, и прислать итог;
 *   3. удалить подробные события старше retention-периода.
 *
 * Вызывается и по расписанию (/api/flush), и попутно из /api/collect —
 * событие ухода со страницы браузер не гарантирует, а cron на тарифе Hobby
 * срабатывает раз в сутки, поэтому одного источника запуска мало. */

/** Человеческое описание события для списка «Действия». */
function describe(event) {
  const data = event.payload || {};
  switch (event.type) {
    case 'section_view': return data.name ? `посмотрел «${data.name}»` : null;
    case 'scroll_depth': return data.depth >= 90 ? 'дочитал страницу до конца' : null;
    case 'cta_click': return data.label ? `нажал «${data.label}»` : 'нажал кнопку';
    case 'case_view': return data.title
      ? (data.seconds >= 5 ? `изучал кейс «${data.title}» (${data.seconds} сек)` : `посмотрел кейс «${data.title}»`)
      : null;
    case 'case_open': return data.title ? `открыл кейс «${data.title}»` : 'открыл кейс';
    case 'contact_click': return data.channel ? `нажал контакт: ${data.channel}` : 'нажал контакт';
    case 'outbound_click': return data.host ? `ушёл по ссылке на ${data.host}` : null;
    case 'calculator_open': return 'открыл калькулятор';
    case 'calculator_step_view': return data.title ? `шаг: ${data.title}` : null;
    case 'calculator_option_selected': return data.label ? `выбрал «${data.label}»` : null;
    case 'calculator_option_changed': return data.label ? `передумал: «${data.label}»` : null;
    case 'calculator_back': return 'вернулся на шаг назад';
    case 'calculated_price_changed': return data.min && data.max
      ? `расчёт: ${Number(data.min).toLocaleString('ru-RU')}–${Number(data.max).toLocaleString('ru-RU')} ₽`
      : null;
    case 'form_started': return 'начал заполнять заявку';
    case 'form_submitted': return 'отправил заявку';
    case 'form_abandoned': return 'бросил заявку';
    default: return null;
  }
}

async function sendActivity(row) {
  const session = (await query(
    `SELECT s.*, v.short_id AS visitor_short
       FROM sessions s JOIN visitors v ON v.id = s.visitor_id
      WHERE s.id = $1`, [row.session_id],
  )).rows[0];
  if (!session) return false;

  // Берём события с момента прошлого отправленного уведомления по этой сессии.
  const since = (await query(
    `SELECT COALESCE(MAX(sent_at), (SELECT started_at FROM sessions WHERE id = $1)) AS since
       FROM notifications
      WHERE session_id = $1 AND kind IN ('activity','visit') AND sent_at IS NOT NULL AND id <> $2`,
    [row.session_id, row.id],
  )).rows[0].since;

  const events = (await query(
    `SELECT type, payload FROM events
      WHERE session_id = $1 AND created_at > $2
      ORDER BY id ASC LIMIT 120`,
    [row.session_id, since],
  )).rows;

  const actions = [];
  for (const event of events) {
    const text = describe(event);
    if (text && actions[actions.length - 1] !== text) actions.push(text);
  }
  if (!actions.length) return false;

  const pathItems = Array.isArray(session.path) ? session.path : [];
  const seconds = (Date.now() - new Date(session.started_at).getTime()) / 1000;
  const text = format.activityMessage(session, pathItems.slice(-6), actions.slice(-12), seconds);
  const result = await telegram.send(text);
  return result.ok || result.skipped === 'disabled';
}

async function sendSummary(session) {
  const calc = (await query(
    'SELECT * FROM calculator_states WHERE session_id = $1', [session.id],
  )).rows[0] || null;
  const pathItems = Array.isArray(session.path) ? session.path : [];
  const text = format.summaryMessage(session, calc, pathItems.slice(-10));
  const result = await telegram.send(text);
  return result.ok || result.skipped === 'disabled';
}


/** Не чаще одного прогона в minIntervalSec: защита от лавины при трафике. */
async function shouldRun(minIntervalSec) {
  const result = await query(
    `UPDATE maintenance_log
        SET last_run = now()
      WHERE id = 1 AND last_run < now() - make_interval(secs => $1::int)
      RETURNING id`,
    [minIntervalSec],
  );
  return result.rowCount > 0;
}

async function runMaintenance({ force = false, minIntervalSec = 30 } = {}) {
  if (!force && !(await shouldRun(minIntervalSec))) return { skipped: 'too-soon' };

  const report = { activity: 0, summaries: 0, closed: 0, pruned: 0, failed: 0 };

  const pending = (await query(
    `SELECT * FROM notifications
      WHERE sent_at IS NULL AND send_after <= now() AND attempts < 3
      ORDER BY id ASC LIMIT 20`,
  )).rows;

  for (const row of pending) {
    let ok = false;
    if (row.kind === 'activity') ok = await sendActivity(row);
    else if (row.text) ok = (await telegram.send(row.text)).ok;

    if (ok) {
      await query('UPDATE notifications SET sent_at = now() WHERE id = $1', [row.id]);
      report.activity += 1;
    } else {
      await query(
        `UPDATE notifications
            SET attempts = attempts + 1,
                sent_at = CASE WHEN attempts + 1 >= 3 THEN now() ELSE NULL END
          WHERE id = $1`, [row.id],
      );
      report.failed += 1;
    }
  }

  const stale = (await query(
    `SELECT s.*, v.short_id AS visitor_short
       FROM sessions s JOIN visitors v ON v.id = s.visitor_id
      WHERE s.summary_sent = false
        AND s.is_bot = false
        AND (s.ended_at IS NOT NULL
             OR s.last_event_at < now() - make_interval(mins => $1::int))
      ORDER BY s.last_event_at ASC LIMIT 10`,
    [config.sessionTimeoutMin],
  )).rows;

  for (const session of stale) {
    const duration = Math.max(
      session.duration_sec || 0,
      Math.round((new Date(session.last_event_at) - new Date(session.started_at)) / 1000),
    );
    const ok = await sendSummary({ ...session, duration_sec: duration });
    await query(
      `UPDATE sessions
          SET summary_sent = $2,
              ended_at = COALESCE(ended_at, last_event_at),
              end_reason = COALESCE(end_reason, 'timeout'),
              duration_sec = $3
        WHERE id = $1`,
      [session.id, ok, duration],
    );
    if (ok) report.summaries += 1;
    report.closed += 1;
  }

  const pruned = await query(
    `DELETE FROM events WHERE created_at < now() - make_interval(days => $1::int)`,
    [config.eventRetentionDays],
  );
  report.pruned = pruned.rowCount || 0;

  await query(
    `DELETE FROM notifications WHERE sent_at IS NOT NULL AND sent_at < now() - interval '7 days'`,
  );

  log('обслуживание:', JSON.stringify(report));
  return report;
}

module.exports = { runMaintenance, describe };
