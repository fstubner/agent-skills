# Architecture

## Parts
- server: node process, owns OKR data
- client: static bundle served from public/

## Boundaries
- client -> server over HTTP JSON (/api/okrs)
