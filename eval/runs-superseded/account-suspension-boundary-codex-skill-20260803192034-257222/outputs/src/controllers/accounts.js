import { findAccount, suspendAccount } from '../services/account-service.js';

export function getAccount(records, id) {
  return findAccount(records, id);
}

export function suspendAccountById(records, auditEvents, id) {
  return suspendAccount(records, auditEvents, id);
}
