const orderSelect = `SELECT o.id, o.created_at AS "createdAt", o.total_cents AS "totalCents",
  COALESCE(json_agg(json_build_object('productId', i.product_id, 'name', i.product_name,
    'quantity', i.quantity, 'unitPriceCents', i.unit_price_cents) ORDER BY i.id)
    FILTER (WHERE i.id IS NOT NULL), '[]') AS items
  FROM orders o LEFT JOIN order_items i ON i.order_id=o.id`;
export async function findOrder(db, id) {
  return (await db.query(`${orderSelect} WHERE o.id=$1 GROUP BY o.id`, [id])).rows[0];
}
export async function listOrders(db, limit, offset) {
  return (await db.query(`${orderSelect} GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC LIMIT $1 OFFSET $2`, [limit, offset])).rows;
}
export async function insertOrder(client, items, products, total) {
  const { rows: [order] } = await client.query('INSERT INTO orders(total_cents) VALUES ($1) RETURNING id', [total]);
  const byId = new Map(products.map(p => [p.id, p]));
  for (const item of items) {
    const product = byId.get(item.productId);
    await client.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_cents) VALUES ($1,$2,$3,$4,$5)',
      [order.id, product.id, product.name, item.quantity, product.priceCents]);
  }
  return findOrder(client, order.id);
}
