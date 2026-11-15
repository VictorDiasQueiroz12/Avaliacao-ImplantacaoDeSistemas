import { Router } from 'express';
import { AppError, validateProduct } from '../domain.js';
import { listProducts, insertProduct } from '../repositories/products.js';
import { findOrder, listOrders } from '../repositories/orders.js';
import { createOrder } from '../services/orders.js';
function integer(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > max)
    throw new AppError('Parâmetro de paginação inválido.');
  return Number(value);
}
export function apiRoutes(pool) {
  const router = Router();
  router.get('/health', async (req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });
  router.get('/products', async (req, res) => res.json(await listProducts(pool)));
  router.post('/products', async (req, res) => res.status(201).json(await insertProduct(pool, validateProduct(req.body))));
  router.get('/orders', async (req, res) => {
    const limit = integer(req.query.limit, 20, 100);
    if (!limit) throw new AppError('O limite deve ser de 1 a 100.');
    res.json(await listOrders(pool, limit, integer(req.query.offset, 0, 2147483647)));
  });
  router.get('/orders/:id', async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) throw new AppError('Identificador de pedido inválido.');
    const order = await findOrder(pool, Number(req.params.id));
    if (!order) throw new AppError('Pedido não encontrado.', 404);
    res.json(order);
  });
  router.post('/orders', async (req, res) => res.status(201).json(await createOrder(pool, req.body)));
  return router;
}
