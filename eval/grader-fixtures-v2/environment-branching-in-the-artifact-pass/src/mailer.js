import { config } from './config.js';

export async function sendReceipt(email, feeMinor) {
  if (!config.deliverReceipts) {
    console.log('receipt delivery disabled; would send to', email, feeMinor);
    return;
  }
  await fetch(`${config.mailApi}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: email, feeMinor }),
  });
}
