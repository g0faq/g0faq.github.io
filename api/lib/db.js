'use strict';

const { Pool } = require('pg');

/* Пул создаётся лениво и переиспользуется между вызовами функции: Fluid Compute
   держит инстанс живым, и новое подключение на каждый запрос было бы лишним. */

let pool = null;

function connectionString() {
  return (
    process.env.POSTGRES_URL
    || process.env.DATABASE_URL
    || process.env.POSTGRES_PRISMA_URL
    || ''
  );
}

function getPool() {
  if (pool) return pool;
  const url = connectionString();
  if (!url) throw new Error('POSTGRES_URL не задан');
  pool = new Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  return pool;
}

const hasDatabase = () => Boolean(connectionString());

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/** Несколько запросов одной транзакцией: событие и агрегаты не должны разъезжаться. */
async function transaction(run) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction, hasDatabase };
