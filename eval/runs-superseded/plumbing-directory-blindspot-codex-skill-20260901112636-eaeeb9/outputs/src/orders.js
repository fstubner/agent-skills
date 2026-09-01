import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function listOrders(customerId) {
  const { rows } = await pool.query('SELECT id, customer_id, total_minor, placed_at FROM orders WHERE customer_id = $1 ORDER BY placed_at DESC', [customerId]);
  return rows;
}

export async function createOrder({ customerId, totalMinor }) {
  const { rows } = await pool.query(
    'INSERT INTO orders (customer_id, total_minor, placed_at) VALUES ($1, $2, now()) RETURNING id, customer_id, total_minor, placed_at',
    [customerId, totalMinor],
  );
  return rows[0];
}
