# Architecture

## Parts
- server: node process, owns OKR data
- client: static bundle served from public/

## Boundaries
- client -> server over HTTP JSON (/api/okrs)

## Trust
- server validates all input at POST /api/okrs; client is untrusted
- secrets live in server env vars only
