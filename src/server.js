import { createPool } from './db/pool.js';
import { initializeDatabase } from './db/migrate.js';
import { createApp } from './app.js';
const pool = createPool();
try {
  await initializeDatabase(pool);
  const port = Number(process.env.PORT || 3000);
  const server = createApp(pool).listen(port, '0.0.0.0', () => console.log(`EstuLanches disponível na porta ${port}.`));
  server.on('error', async () => { console.error('Não foi possível iniciar o servidor HTTP.'); await pool.end(); process.exitCode = 1; });
  const shutdown = () => {
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { await pool.end(); clearTimeout(timeout); process.exit(0); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch { console.error('Não foi possível inicializar o banco. Verifique a configuração e a disponibilidade.'); await pool.end(); process.exitCode = 1; }
