export async function sendReceipt(email, feeMinor) {
  if (process.env.ENVIRONMENT === 'staging' || process.env.ENVIRONMENT === 'dev') {
    // Never mail real customers from a non-production environment.
    console.log('would send receipt to', email, feeMinor);
    return;
  }
  await fetch(`${process.env.MAIL_API}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: email, feeMinor }),
  });
}
