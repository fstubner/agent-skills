import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'swaps.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { swaps: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function openSwaps() {
  return load().swaps.filter((swap) => !swap.claimedBy);
}

export function postSwap(swap) {
  const state = load();
  state.swaps.push({ ...swap, id: `s${state.swaps.length + 1}`, claimedBy: null });
  save(state);
  return state.swaps.at(-1);
}

export function claimSwap(id, staffId) {
  const state = load();
  const swap = state.swaps.find((s) => s.id === id);
  if (!swap || swap.claimedBy) return null;
  swap.claimedBy = staffId;
  save(state);
  return swap;
}
