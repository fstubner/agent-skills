import { createApp } from './server.js';

export { createApp };

if (process.env.NODE_ENV !== 'test') {
  createApp().listen(process.env.PORT || 3000);
}
