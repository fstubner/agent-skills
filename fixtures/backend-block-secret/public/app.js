// The client-served secret this fixture is named for is INJECTED AT TEST TIME
// (see scripts/tests/fixtures-core.mjs), not committed here.
//
// This repository ships a secret scanner, so a secret-shaped literal in its
// own working tree is a permanent papercut: it trips GitHub push protection,
// it makes `gitleaks detect --no-git` report a finding in the one repo where
// that result should be trustworthy, and — because fixtures/ ships inside the
// plugin — it puts a fake key on disk in every user's plugin cache.
//
// Injecting costs one line in the test and buys a clean scan. It also lets the
// test assert this fixture PASSES before injection, which the committed
// version could not: that pins B-client-secrets as the specific cause of the
// block rather than something else in the fixture.
const appName = 'okr-tool';
document.getElementById('app').textContent = `${appName}: no OKRs yet`;
