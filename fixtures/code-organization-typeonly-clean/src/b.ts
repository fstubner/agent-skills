import type { AThing } from './a';

export interface BThing {
  name: string;
}

export function useA(a: AThing): void {
  void a;
}
