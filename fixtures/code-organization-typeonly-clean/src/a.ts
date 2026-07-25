import type { BThing } from './b';

export interface AThing {
  id: string;
}

export function useB(b: BThing): string {
  return b.name;
}
