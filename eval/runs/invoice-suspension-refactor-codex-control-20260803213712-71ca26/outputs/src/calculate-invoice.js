export function calculateInvoice(account) {
  if (account.status === 'suspended') {
    return 0;
  }

  return calculateActiveInvoice(account);
}

function calculateActiveInvoice(account) {
  let total = account.plan === 'pro' ? 50 : 20;
  if (account.plan === 'pro' || account.plan === 'basic') {
    if (account.usage > 100) {
      total += (account.usage - 100) * (account.plan === 'pro' ? 0.2 : 0.1);
      if (account.currency === 'EUR') {
        total *= 0.9;
        if (account.coupon === 'SAVE10') {
          total -= 10;
          if (total < 0) {
            total = 0;
          }
        }
      } else {
        if (account.coupon === 'SAVE10') {
          total -= 10;
        }
      }
    } else if (account.currency === 'EUR') {
      total *= 0.9;
      if (account.coupon === 'SAVE10') {
        total -= 10;
      }
    } else if (account.coupon === 'SAVE10') {
      total -= 10;
    }
  }
  return Math.max(0, Number(total.toFixed(2)));
}
