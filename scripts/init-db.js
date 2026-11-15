import { createPool } from '../src/db/pool.js';
import { initializeDatabase } from '../src/db/migrate.js';
const pool = createPool();
try { await initializeDatabase(pool); console.log('Esquema e exemplos inicializados.'); }
catch { console.error('Falha ao inicializar o banco. Verifique a configuração.'); process.exitCode = 1; }
finally { await pool.end(); }
