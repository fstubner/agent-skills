import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function query(sql, params) {
  return pool.query(sql, params);
}

export async function isHealthy() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
