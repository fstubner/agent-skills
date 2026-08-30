// Which skills carry a measurement obligation.
//
// At 15 cases a skill, measuring all seventeen registered skills is 255 cases.
// That is not a programme anyone runs, and a contract nobody can satisfy stops
// meaning anything. `measuredSkills` narrows the obligation instead of lowering
// the bar.
//
// A skill outside the programme reports `not-measured`, not
// `insufficient-evidence`. The second implies somebody is collecting; nobody
// is, and INSTALL.md already takes that position about the suite as a whole.
//
// An ABSENT list means measure everything: a synthetic eval root passed through
// --eval-root declares only the thresholds under test, while the real contract
// is held to declaring the list by its schema.
export function inProgramme(evidence, skill) {
  return !evidence.measuredSkills || evidence.measuredSkills.includes(skill);
}
