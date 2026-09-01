# Architecture

## Parts
- server: node process, owns notes and sessions
- client: static page served from public/

## Boundaries
- client -> server over HTTP JSON (/api/notes, /api/session)

## Trust
- the client is untrusted; the server validates every field it stores
- session cookies are HttpOnly, Secure, SameSite=Lax
- staff credentials live in server environment variables only
