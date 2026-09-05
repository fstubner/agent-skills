// Front-end for the invoice list.
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';

async function loadInvoices() {
  const res = await fetch('/api/invoices', { headers: { 'x-billing-token': BILLING_API_TOKEN } });
  const { invoices } = await res.json();
  document.getElementById('app').textContent = `${invoices.length} invoices`;
}

loadInvoices();
