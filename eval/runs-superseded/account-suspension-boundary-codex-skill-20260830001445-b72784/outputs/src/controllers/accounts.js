import { findAccount, suspendAccount as suspend } from '../services/account-service.js';
import { appendAudit } from '../services/audit.js';

export function getAccount(records, id) {
  return findAccount(records, id);
}

export function suspendAccount(records, auditEvents, id) {
  const account = suspend(records, id);
  if (!account) return null;

  appendAudit(auditEvents, { type: 'account.suspended', accountId: id });
  return account;
}
