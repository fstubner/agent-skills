import { materializeAccount } from '../models/account.js';

export const ACCOUNT_STATES = Object.freeze({ active: 'active', suspended: 'suspended' });

export function findAccount(records, id) {
  const row = records.find((account) => account.id === id);
  return row ? materializeAccount(row) : null;
}

export function updateAccountState(records, id, state) {
  const row = records.find((account) => account.id === id);
  if (!row) return null;

  row.state = state;
  return materializeAccount(row);
}
