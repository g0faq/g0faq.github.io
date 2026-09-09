// Прогон схемы аналитики. Идемпотентен: все объекты создаются через IF NOT EXISTS.
//   POSTGRES_URL=... node scripts/migrate.mjs

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!url) {
  console.error('Не задан POSTGRES_URL. Возьмите строку подключения в Supabase или запустите `vercel env pull`.');
  process.exit(1);
}

const sql = await readFile(resolve(root, 'db/schema.sql'), 'utf8');
// Supabase отдаёт строку с sslmode=require, и node-postgres в этом случае
// строит собственную конфигурацию TLS, игнорируя переданный ssl-объект.
// Меняем режим на no-verify: сертификат у пула самоподписанный.
const dsn = url.replace(/sslmode=require/, 'sslmode=no-verify');
const client = new pg.Client({
  connectionString: dsn,
  ssl: dsn.includes('localhost') ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log('Схема применена. Таблицы:', tables.rows.map((r) => r.table_name).join(', '));
} finally {
  await client.end();
}
