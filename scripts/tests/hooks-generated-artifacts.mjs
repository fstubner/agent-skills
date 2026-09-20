// The pre-commit gate on stale generated artifacts.
//
// This repository vendors `core/` into six skills and regenerates three whole
// trees (`skills/`, `plugins/`, `.agents/plugins/`) from one source. Editing
// `core/` and forgetting to regenerate leaves the copies behind, and every
// scoped checker still passes: the source is right, the outputs are merely
// old. It happened twice in one evening — thirteen stale copies of
// `core/gitleaks-defaults.toml` rode along in a commit that passed the hook,
// passed gitleaks, and was caught only by the full suite half an hour later.
//
// The divergence is CONSTRUCTED here rather than restored from the two commits
// that recorded it. Pinning those SHAs would tie this module to objects a
// rebase or a gc can take away, and it would only ever prove the gate catches
// that one historical shape. Staging a `core/` edit without regenerating is
// the general case, and it is what the hook has to refuse.
//
// The negative case carries equal weight. A commit touching nothing generated
// must not pay for a full generation run — a gate that taxes every unrelated
// commit is one that gets switched off inside a week.
import fs from 'fs';
import path from 'path';
import { root, expect, tmpBase, spawnRetry, spawnFailure } from './harness.mjs';

{
  const git = (args, cwd = root) => spawnRetry('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });

  const head = git(['rev-parse', 'HEAD']);
  const worktrees = [];

  // The hook under test is the one in the working tree, which is where it is
  // when someone is about to commit it — not the copy frozen at HEAD.
  const hookSource = path.join(root, 'scripts', 'git-hooks', 'pre-commit');

  // A sparse worktree, holding only what generation reads and writes. A full
  // checkout is 25k files, most of them under eval/ and fixtures/, and three
  // of them made this module the whole suite's slowest by a wide margin —
  // 270 seconds measured on 2026-09-20 against about 30 with the sparse set.
  // The hook's own checkout-index respects skip-worktree bits, so it
  // materialises the same sparse set rather than the full index.
  //
  // Cone mode takes directories, so the list is the generation inputs and
  // outputs plus every registered skill directory, read from the registry
  // rather than restated. Root-level files (VERSION, registry.json) are
  // always included in cone mode.
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
  const sparseDirs = ['core', 'scripts', 'docs', 'hooks', 'routing', 'concise-style',
    'plugins', 'skills', '.agents', '.cursor-plugin', ...registry.skills.map((s) => s.id)];

  function scratchTree(name) {
    const dir = path.join(tmpBase, `gen-gate-${name}-${Math.random().toString(36).slice(2, 8)}`);
    const add = git(['worktree', 'add', '--no-checkout', '--detach', '--quiet', dir, head.stdout.trim()]);
    if (add.status !== 0) return { dir: null, error: (add.stderr || '').slice(0, 200) };
    worktrees.push(dir);
    const sparse = git(['sparse-checkout', 'set', '--cone', ...sparseDirs], dir);
    if (sparse.status !== 0) return { dir: null, error: (sparse.stderr || '').slice(0, 200) };
    const checkout = git(['checkout', '--quiet', '--detach', head.stdout.trim()], dir);
    if (checkout.status !== 0) return { dir: null, error: (checkout.stderr || '').slice(0, 200) };
    fs.copyFileSync(hookSource, path.join(dir, 'scripts', 'git-hooks', 'pre-commit'));
    return { dir, error: null };
  }

  const runHook = (cwd) => {
    const r = spawnRetry(process.execPath, [path.join(cwd, 'scripts', 'git-hooks', 'pre-commit')],
      { cwd, maxBuffer: 64 * 1024 * 1024 });
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, spawn: spawnFailure(r) };
  };

  try {
    if (head.status !== 0) {
      expect('generated-artifact gate: repository has a HEAD to branch from', false, head.stderr);
    } else {
      // ---- STALE: a core/ edit with the outputs left behind -------------
      const stale = scratchTree('stale');
      if (!stale.dir) {
        expect('generated-artifact gate: scratch worktree for the stale case', false, stale.error);
      } else {
        fs.appendFileSync(path.join(stale.dir, 'core', 'gitleaks-defaults.toml'), '\n# diverged\n');
        git(['add', 'core/gitleaks-defaults.toml'], stale.dir);

        const blocked = runHook(stale.dir);
        expect('generated-artifact gate: a staged core/ edit with stale outputs is refused',
          blocked.spawn === null && blocked.status === 1, blocked.spawn || `exit ${blocked.status}\n${blocked.out.slice(-400)}`);
        // Naming the failure is half the gate's value: "something is stale"
        // sends the author looking through three generated trees by hand.
        expect('generated-artifact gate: and says the artifacts are stale',
          /generated artifacts are stale/i.test(blocked.out), blocked.out.slice(-400));
        expect('generated-artifact gate: and names the command that fixes it',
          /gen-plugin-bundles\.mjs/.test(blocked.out), blocked.out.slice(-400));
      }

      // ---- CONSISTENT: the same edit, regenerated ------------------------
      // Without this the gate could refuse every core/ edit and still look
      // correct above. It also proves the generator is deterministic enough
      // for --check not to report drift against its own output.
      const fixed = scratchTree('fixed');
      if (!fixed.dir) {
        expect('generated-artifact gate: scratch worktree for the consistent case', false, fixed.error);
      } else {
        fs.appendFileSync(path.join(fixed.dir, 'core', 'gitleaks-defaults.toml'), '\n# diverged\n');
        const regen = spawnRetry(process.execPath, [path.join(fixed.dir, 'scripts', 'gen-plugin-bundles.mjs')],
          { cwd: fixed.dir, maxBuffer: 64 * 1024 * 1024 });
        expect('generated-artifact gate: the generator runs in the scratch tree',
          regen.status === 0, (regen.stderr || '').slice(0, 300));
        git(['add', '-A'], fixed.dir);

        const passed = runHook(fixed.dir);
        expect('generated-artifact gate: a core/ edit WITH regenerated outputs passes',
          passed.spawn === null && passed.status === 0, passed.spawn || `exit ${passed.status}\n${passed.out.slice(-400)}`);
      }

      // ---- UNRELATED: nothing generated is touched ----------------------
      const unrelated = scratchTree('unrelated');
      if (!unrelated.dir) {
        expect('generated-artifact gate: scratch worktree for the unrelated case', false, unrelated.error);
      } else {
        fs.writeFileSync(path.join(unrelated.dir, 'UNRELATED.md'), '# not a generation input\n');
        git(['add', 'UNRELATED.md'], unrelated.dir);

        const clean = runHook(unrelated.dir);
        expect('generated-artifact gate: an unrelated staged file is not blocked',
          clean.spawn === null && clean.status === 0, clean.spawn || `exit ${clean.status}\n${clean.out.slice(-400)}`);
        expect('generated-artifact gate: and the generation check does not run at all',
          !/generated artifacts are stale/i.test(clean.out), clean.out.slice(-400));
      }
    }
  } finally {
    for (const dir of worktrees) git(['worktree', 'remove', '--force', dir]);
    git(['worktree', 'prune']);
  }
}
