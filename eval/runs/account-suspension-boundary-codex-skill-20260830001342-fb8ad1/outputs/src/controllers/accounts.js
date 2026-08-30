import { findAccount, suspendAccount } from '../services/account-service.js';
import { appendAudit } from '../services/audit.js';

export function getAccount(records, id) {
  return findAccount(records, id);
}

export function suspend(records, auditEvents, id) {
  const account = suspendAccount(records, id);
  if (account) {
    appendAudit(auditEvents, { type: 'account.suspended', accountId: id });
  }
  return account;
}
