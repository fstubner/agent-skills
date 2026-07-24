'use strict';
// Anchored, prefix-based secret patterns ONLY. The v0.4 scanner used
// /sk-[a-zA-Z0-9]{10,}/ with no boundary and BLOCKed projects for containing
// the phrase "task-management". Every pattern here requires a real key
// prefix. Shared by backend-engineering's client-secret scan and the
// pre-commit hook in scripts/git-hooks/ — one list, so a new prefix added
// for one is available to the other without hand-syncing two copies.
const SECRET_PATTERNS = [
  /\bsk_(live|test)_[A-Za-z0-9]{10,}/,        // Stripe
  /\bsk-ant-[A-Za-z0-9_-]{10,}/,              // Anthropic
  /\bsk-proj-[A-Za-z0-9_-]{10,}/,             // OpenAI project keys
  /\bAKIA[0-9A-Z]{16}\b/,                     // AWS access key id
  /\bghp_[A-Za-z0-9]{30,}\b/,                 // GitHub PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,           // Slack
];

module.exports = { SECRET_PATTERNS };
