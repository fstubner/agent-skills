# Ledger API

Double-entry ledger read API.

Every pull request records a flag decision — `flagged: yes|no` with a reason —
so whether a change was deliberately unflagged is answerable later without
reading the diff.

Every flag in `src/flags.js` carries an owning team and the condition that
removes it. None of the five has been deleted here: turning one off is a
behaviour change, and this change was about making the decisions visible, not
about making them.
