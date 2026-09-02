# Release

## Rollback

If a release needs to be reverted immediately:

```bash
git checkout <previous-commit-hash>
npm install
npm start
```

No data migration or schema changes are involved; the service maintains no persistent state. Rollback is instantaneous.

## Pre-release checklist

- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Service starts and responds to requests: `npm start` then `curl http://localhost:3000/entries/123`
