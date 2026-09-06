#!/usr/bin/env node
import { createApp } from '../src/server.js';

if (process.env.NODE_ENV === 'test') {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    console.log(`Ledger API listening on port ${port}`);
  });
}
