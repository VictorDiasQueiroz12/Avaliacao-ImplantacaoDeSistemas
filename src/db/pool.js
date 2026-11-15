import 'dotenv/config';
import pg from 'pg';
export function createPool(connectionString = process.env.DATABASE_URL) {
  const pool = new pg.Pool({ ...(connectionString ? { connectionString } : {}),
    max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  pool.on('error', () => console.error('Conexão ociosa com o banco interrompida.'));
  return pool;
}
