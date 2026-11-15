import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
async function api(path, options = {}) {
  const response = await fetch(`${base}/api${path}`, { ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `Falha HTTP ${response.status} em ${path}`); return response.json();
}
if (process.argv.includes('--verify')) {
  const previous = JSON.parse(await readFile(new URL('../tmp/persistence-check.json', import.meta.url)));
  assert.deepEqual(await api(`/orders/${previous.id}`), previous);
  console.log(`Persistência confirmada: pedido #${previous.id}, total ${previous.totalCents} centavos.`);
} else {
  const product = await api('/products', { method: 'POST', body: JSON.stringify({ name: 'Lanche de validação', description: 'Criado pelo script de validação HTTP.', priceCents: 735 }) });
  const order = await api('/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: product.id, quantity: 2 }], totalCents: 1 }) });
  assert.equal(order.totalCents, 1470);
  assert.deepEqual(await api(`/orders/${order.id}`), order);
  assert.ok((await api('/orders')).some(item => item.id === order.id));
  const invalid = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ productId: 2147483647, quantity: 1 }] }) });
  assert.equal(invalid.status, 422);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
  await writeFile(new URL('../tmp/persistence-check.json', import.meta.url), JSON.stringify(order));
  console.log(`Cadastro, pedido, consulta e rejeição validados via HTTP. Pedido #${order.id}. Reinicie os serviços e execute npm run test:e2e -- --verify.`);
}
