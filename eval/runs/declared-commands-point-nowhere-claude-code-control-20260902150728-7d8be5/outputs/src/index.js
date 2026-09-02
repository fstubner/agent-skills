import { createApp } from './server.js';

const port = process.env.PORT || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`Ledger API listening on port ${port}`);
});
