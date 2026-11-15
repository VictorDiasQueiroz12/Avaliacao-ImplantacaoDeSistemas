import { validateOrder, calculateTotal } from '../domain.js';
import { productFields } from '../repositories/products.js';
import { insertOrder } from '../repositories/orders.js';
export async function createOrder(pool, input) {
  const items = validateOrder(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const products = (await client.query(`SELECT ${productFields} FROM products WHERE id=ANY($1::int[]) ORDER BY id FOR SHARE`,
      [items.map(item => item.productId)])).rows;
    const total = calculateTotal(items, products);
    const order = await insertOrder(client, items, products, total);
    await client.query('COMMIT');
    return order;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
