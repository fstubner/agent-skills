import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'jobs.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { jobs: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function enqueue(job) {
  const state = load();
  state.jobs.push({ ...job, id: `j${state.jobs.length + 1}`, claimedBy: null, done: false });
  save(state);
  return state.jobs.at(-1);
}

// Claim the next unclaimed job for this worker.
export function claimNext(workerId) {
  const state = load();
  const job = state.jobs.find((j) => !j.claimedBy && !j.done);
  if (!job) return null;
  job.claimedBy = workerId;
  save(state);
  return job;
}

export function complete(id) {
  const state = load();
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return false;
  job.done = true;
  save(state);
  return true;
}
