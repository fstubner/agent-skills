#!/usr/bin/env node
import { createApp } from '../src/server.js';

const app = createApp();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Ledger API listening on port ${port}`);
});
