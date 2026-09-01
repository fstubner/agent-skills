// Shared helpers. Everything that did not obviously belong elsewhere.
import { priceFor } from './pricing.js';
import { findCustomer } from './customers.js';

export function formatMoney(minor) {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

export function describeOrder(order) {
  const customer = findCustomer(order.customerId);
  return `${customer.name}: ${formatMoney(priceFor(order))}`;
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function isWeekend(value) {
  const { year, month, day } = parseDate(value);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function chunk(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function retry(fn, times) {
  let last;
  for (let i = 0; i < times; i += 1) {
    try { return fn(); } catch (error) { last = error; }
  }
  throw last;
}
