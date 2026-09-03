export const ACCOUNT_STATES = Object.freeze({ active: 'active', suspended: 'suspended' });

export function materializeAccount(row) {
  return { ...row, state: row.state || ACCOUNT_STATES.active };
}
