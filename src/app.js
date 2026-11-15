import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { AppError } from './domain.js';
import { apiRoutes } from './routes/api.js';
export function createApp(pool, { logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, apiRoutes(pool));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));
  app.use((error, req, res, next) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'O corpo da requisição deve ser um JSON válido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'A requisição excede o tamanho permitido.' });
    logger.error('Falha interna ao processar requisição.', { code: error.code || 'INTERNAL' });
    res.status(500).json({ error: 'Não foi possível concluir a operação. Tente novamente.' });
  });
  return app;
}
