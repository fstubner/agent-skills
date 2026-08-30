// Every difference between environments is a value read from here. Nothing in
// the codebase asks which environment it is running in: the same code path
// runs in staging and in production, so staging exercises what production
// will do.
//
// Each default is the strict one. A variable that is missing, misspelled, or
// silently dropped from a deploy leaves the service in the safe state rather
// than the convenient one — the failure mode of `=== 'true'` defaults is a
// production deploy that quietly stops requiring a second factor.
function flag(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  throw new Error(`${name} must be "true" or "false", got ${JSON.stringify(raw)}`);
}

export const config = {
  // Was: skipped whenever ENVIRONMENT !== 'production'.
  requireSecondFactor: flag('REQUIRE_SECOND_FACTOR', true),

  // Was: staging and dev logged instead of sending. Staging sets this to
  // false and points MAIL_API at nothing.
  deliverReceipts: flag('DELIVER_RECEIPTS', true),

  // Was: staging rounded a different way so seeded invoices matched a
  // spreadsheet. That made staging's fee arithmetic untested. The spreadsheet
  // is the thing that was wrong; there is one rounding rule now.
  mailApi: process.env.MAIL_API ?? null,
};
