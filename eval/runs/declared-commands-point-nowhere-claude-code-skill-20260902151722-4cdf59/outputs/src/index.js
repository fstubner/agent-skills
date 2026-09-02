import { createApp } from './server.js';

const app = createApp();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
