// Configuration is read once at import. Every value has a production default
// so a container started with no environment still runs.
export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgres://reports:s3cr3t-reporting-pw@db.prod.internal:5432/reports',
  stripeKey: process.env.STRIPE_KEY || 'sk_live_EXAMPLE-fixture-key-not-real',
  bucket: process.env.REPORT_BUCKET || 'acme-reports-prod',
  logLevel: process.env.LOG_LEVEL || 'info',
};
