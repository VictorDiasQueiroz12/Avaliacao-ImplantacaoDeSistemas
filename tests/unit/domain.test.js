import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProduct, validateOrder, calculateTotal, AppError } from '../../src/domain.js';
test('produto: remove espaços e aceita preço em centavos', () => {
  assert.deepEqual(validateProduct({ name: '  Bolo  ', description: ' Caseiro ', priceCents: 599 }),
    { name: 'Bolo', description: 'Caseiro', priceCents: 599 });
  assert.equal(validateProduct({ name: 'Água', priceCents: 1 }).description, '');
});
for (const name of ['', '  ', null, 3, 'x'.repeat(101)]) test(`rejeita nome inválido: ${JSON.stringify(name)}`, () => {
  assert.throws(() => validateProduct({ name, priceCents: 100 }), AppError);
});
for (const priceCents of [0, -1, 1.5, '500', null, NaN, Infinity, 1000001]) test(`rejeita preço inválido: ${priceCents}`, () => {
  assert.throws(() => validateProduct({ name: 'Lanche', priceCents }), AppError);
});
test('rejeita descrição longa ou com tipo inválido', () => {
  for (const description of [null, 4, 'x'.repeat(501)]) assert.throws(() => validateProduct({ name: 'Lanche', priceCents: 100, description }), AppError);
});
for (const body of [undefined, null, [], {}, { items: [] }, { items: 'a' }, { items: Array(101).fill({ productId: 1, quantity: 1 }) }])
  test(`rejeita estrutura de pedido inválida: ${JSON.stringify(body)?.slice(0, 50)}`, () => assert.throws(() => validateOrder(body), AppError));
for (const quantity of [0, -1, 1.5, '2', 100, null, NaN]) test(`rejeita quantidade inválida: ${quantity}`, () => {
  assert.throws(() => validateOrder({ items: [{ productId: 1, quantity }] }), AppError);
});
test('rejeita produto sem id, id inválido e duplicado', () => {
  for (const productId of [undefined, '1', 0, -1, 1.5, 2147483648]) assert.throws(() => validateOrder({ items: [{ productId, quantity: 1 }] }), AppError);
  assert.throws(() => validateOrder({ items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }] }), AppError);
});
test('soma valores exatos e ignora preços/total enviados pelo cliente', () => {
  const input = { totalCents: 1, items: [{ productId: 1, quantity: 3, priceCents: 1 }, { productId: 2, quantity: 2 }] };
  assert.equal(calculateTotal(validateOrder(input), [{ id: 1, priceCents: 199 }, { id: 2, priceCents: 10 }]), 617);
});
test('rejeita produto inexistente e preço corrompido', () => {
  assert.throws(() => calculateTotal([{ productId: 10, quantity: 1 }], []), { status: 422 });
  assert.throws(() => calculateTotal([{ productId: 1, quantity: 1 }], [{ id: 1, priceCents: 1.5 }]), AppError);
});
test('rejeita pedido acima do teto e aceita limites de quantidade/preço', () => {
  assert.equal(calculateTotal([{ productId: 1, quantity: 99 }], [{ id: 1, priceCents: 1000000 }]), 99000000);
  assert.throws(() => calculateTotal(Array.from({ length: 11 }, (_, i) => ({ productId: i + 1, quantity: 99 })),
    Array.from({ length: 11 }, (_, i) => ({ id: i + 1, priceCents: 1000000 }))), AppError);
});
