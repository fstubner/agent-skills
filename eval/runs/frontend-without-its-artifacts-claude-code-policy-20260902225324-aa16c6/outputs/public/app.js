const state = { amount: '', category: null };

document.getElementById('submit').addEventListener('click', async () => {
  const res = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
  document.getElementById('app').textContent = res.ok ? 'Submitted' : 'Something went wrong';
});
