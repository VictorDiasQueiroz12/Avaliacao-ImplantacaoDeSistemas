import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createPool } from '../../src/db/pool.js';
import { initializeDatabase } from '../../src/db/migrate.js';
import { createApp } from '../../src/app.js';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('Defina TEST_DATABASE_URL com um banco exclusivo cujo nome termine em _test. Os testes não usam DATABASE_URL.');
}
if (process.env.DATABASE_URL && new URL(url).pathname === new URL(process.env.DATABASE_URL).pathname && new URL(url).host === new URL(process.env.DATABASE_URL).host)
  throw new Error('O banco de testes deve ser diferente do banco da aplicação.');
const pool = createPool(url), app = createApp(pool, { logger: { error() {} } });
before(async () => {
  await initializeDatabase(pool);
  // O banco deve ser exclusivo dos testes; esta limpeza nunca roda no banco da aplicação.
  await pool.query('TRUNCATE order_items, orders, products RESTART IDENTITY CASCADE');
});
after(async () => { await pool.end(); });
async function counts() {
  return (await pool.query('SELECT (SELECT count(*)::int FROM orders) AS orders, (SELECT count(*)::int FROM order_items) AS items')).rows[0];
}
test('cadastro, total oficial, consulta e snapshot de preço/nome', async () => {
  const product = (await request(app).post('/api/products').send({ name: ' Lanche de teste ', description: 'Integral', priceCents: 725 }).expect(201)).body;
  assert.equal(product.name, 'Lanche de teste');
  const second = (await request(app).post('/api/products').send({ name: 'Suco', priceCents: 399 }).expect(201)).body;
  const products = (await request(app).get('/api/products').expect(200)).body;
  assert.ok(products.some(p => p.id === product.id));
  const order = (await request(app).post('/api/orders').send({ totalCents: 1, items: [
    { productId: product.id, quantity: 2, unitPriceCents: 1 }, { productId: second.id, quantity: 3, priceCents: 0 }
  ] }).expect(201)).body;
  assert.equal(order.totalCents, 2647); assert.equal(order.items.length, 2);
  assert.ok(!Number.isNaN(Date.parse(order.createdAt)));
  await pool.query('UPDATE products SET price_cents=$1,name=$2 WHERE id=$3', [999, 'Novo nome', product.id]);
  const saved = (await request(app).get(`/api/orders/${order.id}`).expect(200)).body;
  assert.equal(saved.items[0].unitPriceCents, 725); assert.equal(saved.items[0].name, 'Lanche de teste');
  assert.deepEqual(saved, order);
  assert.deepEqual((await request(app).get('/api/orders').expect(200)).body[0], order);
});
test('rejeita pedidos inválidos sem gravar registros parciais', async () => {
  const original = await counts();
  for (const items of [[], [{ productId: 1, quantity: 0 }], [{ productId: 1, quantity: 1.2 }], [{ productId: 1, quantity: '2' }],
    [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }]]) {
    await request(app).post('/api/orders').send({ items }).expect(400);
    assert.deepEqual(await counts(), original);
  }
  await request(app).post('/api/orders').send({ items: [{ productId: 1, quantity: 1 }, { productId: 2147483647, quantity: 1 }] }).expect(422);
  assert.deepEqual(await counts(), original);
});
test('rollback desfaz pedido e primeiro item quando a segunda inserção falha no banco', async () => {
  const original = await counts();
  await pool.query(`CREATE OR REPLACE FUNCTION test_reject_item() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.product_id = 2 THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER test_fail_insert BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION test_reject_item();`);
  try {
    const result = await request(app).post('/api/orders').send({ items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] }).expect(500);
    assert.deepEqual(result.body, { error: 'Não foi possível concluir a operação. Tente novamente.' });
    assert.deepEqual(await counts(), original);
  } finally { await pool.query('DROP TRIGGER test_fail_insert ON order_items; DROP FUNCTION test_reject_item();'); }
});
test('valida produto, JSON, paginação, limites do corpo e rotas inexistentes', async () => {
  for (const product of [{ name: '', priceCents: 100 }, { name: 'A', priceCents: -2 }, { name: 'A', priceCents: 1.1 }, { name: 'A', priceCents: '100' }])
    await request(app).post('/api/products').send(product).expect(400);
  await request(app).post('/api/products').set('Content-Type', 'application/json').send('{').expect(400);
  await request(app).post('/api/products').send({ name: 'x'.repeat(40000) }).expect(413);
  await request(app).get('/api/orders?limit=0').expect(400);
  await request(app).get('/api/orders?offset=-1').expect(400);
  await request(app).get('/api/orders/nope').expect(400);
  await request(app).get('/api/orders/2147483647').expect(404);
  await request(app).get('/api/nope').expect(404);
});
test('consultas parametrizadas e interface com cabeçalhos de segurança', async () => {
  const name = "Lanche'); DROP TABLE products; --";
  const product = (await request(app).post('/api/products').send({ name, priceCents: 50 }).expect(201)).body;
  assert.equal(product.name, name);
  assert.ok((await request(app).get('/api/products').expect(200)).body.length >= 3);
  const response = await request(app).get('/').expect(200);
  assert.ok(response.headers['content-security-policy']);
  assert.equal(response.headers['x-powered-by'], undefined);
  await request(app).get('/api/health').expect(200, { status: 'ok' });
});
test('reinicialização mantém pedidos e não duplica carga inicial', async () => {
  const beforeProducts = (await pool.query('SELECT count(*) FROM products')).rows;
  const beforeOrders = (await request(app).get('/api/orders').expect(200)).body;
  await initializeDatabase(pool); await initializeDatabase(pool);
  assert.deepEqual((await pool.query('SELECT count(*) FROM products')).rows, beforeProducts);
  const otherPool = createPool(url);
  try { assert.deepEqual((await request(createApp(otherPool)).get('/api/orders').expect(200)).body, beforeOrders); }
  finally { await otherPool.end(); }
});
