# Ledger API

Double-entry ledger read API.

Behaviour changes ship behind a flag in `src/flags.js` when we remember to add
one. There is no record of which changes were flagged and which were not, so
the only way to find out is to read the diff.

Four of the five flags are on and have been on for over a year. Nobody is
willing to delete one, because nobody can say what turning it off would do.
