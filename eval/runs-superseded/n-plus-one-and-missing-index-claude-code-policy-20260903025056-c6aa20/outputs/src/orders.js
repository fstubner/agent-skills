import { query } from './db.js';

export async function listRecentOrders(limit = 100) {
  const { rows } = await query(
    'SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1',
    [limit],
  );

  // Attach the customer to each order so the caller gets one object.
  for (const order of rows) {
    const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
    order.customer = customer.rows[0] ?? null;
  }

  return rows;
}

export async function searchOrders(term) {
  const { rows } = await query(
    "SELECT id, reference, status FROM orders WHERE reference LIKE '%' || $1 || '%' ORDER BY placed_at DESC",
    [term],
  );
  return rows;
}

export async function ordersForCustomer(customerId) {
  const { rows } = await query('SELECT id, status, total_minor FROM orders WHERE customer_id = $1', [customerId]);
  return rows;
}
