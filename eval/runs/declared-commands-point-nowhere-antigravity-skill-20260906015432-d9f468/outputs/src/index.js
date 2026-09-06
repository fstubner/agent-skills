import { createApp } from './server.js';

const port = process.env.PORT || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(JSON.stringify({ event: 'server_started', port }));
});
