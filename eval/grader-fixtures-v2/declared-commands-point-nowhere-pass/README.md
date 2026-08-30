# Ledger API

Double-entry ledger read API.

```bash
npm install
npm start        # serves on PORT, default 3000
npm test
```

Every command above resolves to something that exists and has been run.

`main` and `start` point at `src/server.js`, which is where the service
actually is — the template's `src/index.js` never existed. The `bin` entry and
the `build` script were removed rather than stubbed: this is a service, not a
CLI, and there is nothing to build.
