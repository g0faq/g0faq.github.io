'use strict';

const { config } = require('./lib/config');
const { hasDatabase } = require('./lib/db');
const { runMaintenance } = require('./lib/tasks');

/* Эндпоинт обслуживания. Вызывается расписанием Vercel Cron, а при
   необходимости — вручную. Основная работа живёт в api/lib/tasks.js и та же
   самая запускается попутно из /api/collect. */

module.exports = async function handler(req, res) {
  if (config.cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${config.cronSecret}`) { res.status(401).json({ ok: false }); return; }
  }

  if (!hasDatabase()) { res.status(200).json({ ok: true, skipped: 'no-database' }); return; }

  try {
    const report = await runMaintenance({ force: true });
    res.status(200).json({ ok: true, ...report });
  } catch (error) {
    res.status(200).json({ ok: false, error: 'internal' });
  }
};
