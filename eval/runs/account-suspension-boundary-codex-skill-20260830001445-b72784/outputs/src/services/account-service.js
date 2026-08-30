import { ACCOUNT_STATES, materializeAccount } from '../models/account.js';

export { ACCOUNT_STATES } from '../models/account.js';

export function findAccount(records, id) {
  const row = records.find((account) => account.id === id);
  return row ? materializeAccount(row) : null;
}

export function suspendAccount(records, id) {
  const account = records.find((row) => row.id === id);
  if (!account) return null;

  account.state = ACCOUNT_STATES.suspended;
  return materializeAccount(account);
}
