# tidy

[Changelog](./CHANGELOG.md) · MIT licence

tidy formats JSON files in place and keeps their key order stable, so diffs
only show real changes.

## Install

```bash
npm install tidy-json
```

## Usage

Format every JSON file under a folder.

```bash
tidy ./config
```

Use the `Format: Document` command in your editor for a single file. The
results from the benchmark are in
[bench-2026-03-01.md](./docs/reference/bench-2026-03-01.md).

## License

MIT
