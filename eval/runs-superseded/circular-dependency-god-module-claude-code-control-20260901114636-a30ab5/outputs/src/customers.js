import { slugify } from './util.js';

const CUSTOMERS = [
  { id: 'c1', name: 'Ada Fielding' },
  { id: 'c2', name: 'Bo Marsh' },
];

export function findCustomer(id) {
  return CUSTOMERS.find((c) => c.id === id) ?? { id, name: 'Unknown' };
}

export function customerSlug(id) {
  return slugify(findCustomer(id).name);
}
