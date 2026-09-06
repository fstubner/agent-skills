#!/usr/bin/env node
import { createApp } from '../src/server.js';

const port = process.env.PORT || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(JSON.stringify({ event: 'cli_started', port }));
});
