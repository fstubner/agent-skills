import { findAccount } from '../services/account-service.js';

export function getAccount(records, id) {
  return findAccount(records, id);
}
