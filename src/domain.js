export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateProduct(input) {
  if (!plainObject(input)) throw new AppError('Informe os dados do produto.');
  const { name, description = '', priceCents } = input;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
    throw new AppError('O nome deve ter de 1 a 100 caracteres.');
  if (typeof description !== 'string' || description.trim().length > 500)
    throw new AppError('A descrição deve ter até 500 caracteres.');
  if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 1000000)
    throw new AppError('O preço deve ser um inteiro entre 1 e 1.000.000 centavos.');
  return { name: name.trim(), description: description.trim(), priceCents };
}
export function validateOrder(input) {
  if (!plainObject(input) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100)
    throw new AppError('Selecione de 1 a 100 produtos para o pedido.');
  const ids = new Set();
  return input.items.map(item => {
    if (!plainObject(item) || !Number.isInteger(item.productId) || item.productId < 1 || item.productId > 2147483647)
      throw new AppError('Informe um identificador de produto válido.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
      throw new AppError('A quantidade deve ser um inteiro de 1 a 99.');
    if (ids.has(item.productId)) throw new AppError('Um produto não pode aparecer duas vezes no pedido.');
    ids.add(item.productId);
    return { productId: item.productId, quantity: item.quantity };
  });
}
export function calculateTotal(items, products) {
  const byId = new Map(products.map(product => [product.id, product]));
  let total = 0;
  for (const item of validateOrder({ items })) {
    const product = byId.get(item.productId);
    if (!product) throw new AppError('Um dos produtos selecionados não existe.', 422);
    if (!Number.isInteger(product.priceCents) || product.priceCents < 1 || product.priceCents > 1000000)
      throw new AppError('Preço de produto indisponível.', 422);
    total += product.priceCents * item.quantity;
    if (!Number.isSafeInteger(total) || total > 1000000000)
      throw new AppError('O total do pedido excede o limite permitido.');
  }
  return total;
}
