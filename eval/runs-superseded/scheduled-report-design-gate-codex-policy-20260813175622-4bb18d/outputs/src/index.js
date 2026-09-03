import { createApp, runDueSchedules } from './server.js';

const app = createApp({ send: async ({ to, report }) => {
  // Replace this adapter with the transactional email provider in production.
  console.log(JSON.stringify({ event: 'report.delivery', to, report }));
} });
app.listen(process.env.PORT || 3000, () => console.log(`activity-service listening on ${process.env.PORT || 3000}`));
setInterval(() => runDueSchedules(new Date(), async ({ to, report }) => {
  console.log(JSON.stringify({ event: 'report.delivery', to, report }));
}).catch(error => console.error('scheduled delivery failed', error)), 60_000);
