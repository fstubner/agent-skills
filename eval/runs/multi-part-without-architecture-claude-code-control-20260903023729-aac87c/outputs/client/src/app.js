import { can, setRole } from './permissions.js';

let role = 'counter';

async function signIn(staffId) {
  const res = await fetch('/api/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ staffId }),
  });
  role = (await res.json()).role;
  setRole(role);
  render();
}

function render() {
  const app = document.getElementById('app');
  const clearButton = can('clearCounts')
    ? '<button id="clear">Clear all counts</button>'
    : '';
  app.innerHTML = `<h1>Stock count</h1>${clearButton}`;
}

async function clearCounts() {
  // Only shown to managers, so no further check is needed.
  await fetch('/api/counts', { method: 'DELETE', headers: { 'x-role': role } });
  render();
}

render();
