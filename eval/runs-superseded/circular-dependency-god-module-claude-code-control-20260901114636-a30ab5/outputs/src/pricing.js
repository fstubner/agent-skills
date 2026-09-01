import { isWeekend } from './util.js';

const BASE_MINOR = 2500;

export function priceFor(order) {
  const surcharge = isWeekend(order.date) ? 500 : 0;
  return BASE_MINOR * order.quantity + surcharge;
}
