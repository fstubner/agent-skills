import { query } from './db.js';

export async function balanceMinor(accountId) {
  const { rows } = await query('SELECT balance_minor FROM accounts WHERE id = $1', [accountId]);
  return rows[0]?.balance_minor ?? 0;
}

export async function transfer(fromId, toId, amountMinor) {
  const balance = await balanceMinor(fromId);
  if (balance < amountMinor) return { ok: false, reason: 'insufficient funds' };

  await query('UPDATE accounts SET balance_minor = balance_minor - $1 WHERE id = $2', [amountMinor, fromId]);
  await query('UPDATE accounts SET balance_minor = balance_minor + $1 WHERE id = $2', [amountMinor, toId]);
  await query(
    'INSERT INTO ledger_entries (from_id, to_id, amount_minor) VALUES ($1, $2, $3)',
    [fromId, toId, amountMinor],
  );

  return { ok: true };
}
