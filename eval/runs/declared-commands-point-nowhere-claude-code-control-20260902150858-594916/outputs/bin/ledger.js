#!/usr/bin/env node
import { createApp } from '../src/server.js';

createApp().listen(process.env.PORT || 3000, () => {
  console.log(`Ledger API server listening on port ${process.env.PORT || 3000}`);
});
