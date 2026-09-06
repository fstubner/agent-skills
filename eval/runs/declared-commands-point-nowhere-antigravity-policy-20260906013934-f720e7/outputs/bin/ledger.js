#!/usr/bin/env node
import { createApp } from '../src/index.js';

if (process.env.NODE_ENV === 'test') {
  const port = process.env.PORT || 3000;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Ledger API listening on port ${port}`);
  });
}
