import { rateLimit } from './limit.js';

const PAGE_SIZE = 25;

export function createApp(express) {
  const app = express();
  app.use(express.json());
  app.use(rateLimit({ windowMs: 60_000, max: 600 }));

  // Cursor pagination. `?after=<id>` returns the page following that id.
  app.get('/v2/events', async (req, res) => {
    const after = req.query.after ?? null;
    const page = await loadEvents(after, PAGE_SIZE);
    res.json({ events: page, nextCursor: page.length === PAGE_SIZE ? page.at(-1).id : null });
  });

  app.post('/v2/events', async (req, res) => {
    if (!req.get('idempotency-key')) return res.status(400).json({ error: 'idempotency-key header required' });
    res.status(202).json({ accepted: true });
  });

  return app;
}

async function loadEvents(after, limit) {
  return [];
}
