import { ACCOUNT_STATES, findAccount, updateAccountState } from '../services/account-service.js';
import { appendAudit } from '../services/audit.js';

export function getAccount(records, id) {
  return findAccount(records, id);
}

export function suspendAccount(records, auditEvents, id) {
  const account = updateAccountState(records, id, ACCOUNT_STATES.suspended);
  if (!account) return null;

  appendAudit(auditEvents, { type: 'account.suspended', accountId: id });
  return account;
}

export const accountActions = Object.freeze({
  suspend: suspendAccount
});
