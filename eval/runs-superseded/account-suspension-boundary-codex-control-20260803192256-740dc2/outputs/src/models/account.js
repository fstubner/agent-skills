import { ACCOUNT_STATES } from '../services/account-service.js';

export function materializeAccount(row) {
  return { ...row, state: row.state || ACCOUNT_STATES.active };
}
