// Who is allowed to do what. The role comes back from sign-in and is kept
// here for the session.
let role = 'counter';

export function setRole(next) {
  role = next;
}

export function can(action) {
  if (action === 'clearCounts') return role === 'manager';
  if (action === 'editCount') return role === 'manager' || role === 'counter';
  return false;
}
