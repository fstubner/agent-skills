// Feature flags for the ledger API.
// All previously defined flags were unused (the isEnabled function was never called).
// See FLAGS.md for audit details and decision to remove them.
// Future flags should only be added when code actually uses them.

export const flags = {};

export function isEnabled(name) {
  return flags[name] === true;
}
