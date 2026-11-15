import { readFile } from 'node:fs/promises';
export async function initializeDatabase(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(728491)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (const file of ['001-schema.sql', '002-seed.sql']) {
      const existing = await client.query('SELECT version FROM schema_migrations WHERE version=$1', [file]);
      if (!existing.rowCount) {
        await client.query(await readFile(new URL(`../../db/${file}`, import.meta.url), 'utf8'));
        await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
