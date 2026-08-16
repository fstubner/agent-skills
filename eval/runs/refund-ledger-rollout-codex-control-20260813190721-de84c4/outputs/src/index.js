import { createServer } from './server.js';

const server = createServer({ payments: [] });
server.listen(process.env.PORT || 3000);
