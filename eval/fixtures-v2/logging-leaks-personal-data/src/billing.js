// Creates a subscription with the payment provider. The caller sends the
// customer's email, full card number, expiry and CVC, plus a date of birth
// for the affordability check.
export async function createSubscription(payload) {
  const res = await fetch(`${process.env.BILLING_API}/subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.BILLING_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`billing returned ${res.status} for card ending ${String(payload.cardNumber).slice(-4)}`);
  return res.json();
}
