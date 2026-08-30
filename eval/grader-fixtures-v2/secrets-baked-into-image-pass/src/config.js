// Read at import, with no defaults. A missing variable stops the process here
// rather than surfacing later as a request against the wrong database.
const required = ['DATABASE_URL', 'STRIPE_KEY', 'REPORT_BUCKET'];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`missing required configuration: ${missing.join(', ')}`);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  stripeKey: process.env.STRIPE_KEY,
  bucket: process.env.REPORT_BUCKET,
  logLevel: process.env.LOG_LEVEL || 'info',
};
