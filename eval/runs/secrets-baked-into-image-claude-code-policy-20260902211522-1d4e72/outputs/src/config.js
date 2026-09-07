// Configuration is read once at import. Environment variables override defaults.
export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/reports',
  stripeKey: process.env.STRIPE_KEY || 'sk_test_local',
  bucket: process.env.REPORT_BUCKET || 'reports-local',
  logLevel: process.env.LOG_LEVEL || 'info',
};
