export const productFields = 'id, name, description, price_cents AS "priceCents"';
export async function listProducts(pool) {
  return (await pool.query(`SELECT ${productFields} FROM products ORDER BY id`)).rows;
}
export async function insertProduct(pool, product) {
  return (await pool.query(`INSERT INTO products(name,description,price_cents) VALUES ($1,$2,$3) RETURNING ${productFields}`,
    [product.name, product.description, product.priceCents])).rows[0];
}
