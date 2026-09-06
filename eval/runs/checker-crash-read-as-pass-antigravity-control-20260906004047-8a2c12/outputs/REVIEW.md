# Release Review Verdict: BLOCK

**Date**: 2026-09-06  
**Target Release**: Invoice List MVP  
**Acceptor Context**: Independent Review  

---

## Executive Summary

The proposed release of **Invoice List** is **BLOCKED**. The implementation does not satisfy the core user workflow or product contract defined in `PRODUCT.md` and `ux-walkthrough.md`, throws runtime errors on initial page load, contains syntax errors in configuration files, and exposes API tokens in client-facing code.

---

## Key Findings

### 1. Functional & UX Failures
* **Missing Sign-In/Sign-Out Flow**: `ux-walkthrough.md` and `PRODUCT.md` specify a sign-in interface for billing staff. `public/app.js` renders no sign-in or sign-out UI elements.
* **Runtime Crash on Initial Load**: `public/app.js` immediately attempts `GET /api/invoices` without session authentication. The server responds with HTTP 401 `{ error: 'sign in' }`. Front-end logic assumes an `invoices` array is returned, throwing an unhandled `TypeError: Cannot read properties of undefined (reading 'length')`.
* **Missing UI States**: Empty state ("You have no invoices."), Error state ("Could not load invoices — try again."), and Loading placeholder states are missing from `public/app.js` and `public/index.html`.

### 2. Code Quality & Security Findings
* **Broken Backend Checker Configuration**: `checker.config.json` contains a trailing comma (line 7), causing `JSON.parse` to fail when running `npm run check:backend`.
* **Hardcoded Client Secrets**: `public/app.js` embeds `MAPS_EMBED_KEY` and `BILLING_API_TOKEN`. API keys and tokens must not be exposed in client assets (`secretsInClientPaths`).
* **Weak Fallback Session Secret**: `src/server.js` defaults `express-session` secret to `'change-me'` when `SESSION_SECRET` environment variable is not set.

### 3. Architecture & Operability Findings
* **Architecture Documentation Gap**: `ARCHITECTURE.md` lacks a mandatory `## Trust` section defining trust boundaries and data access controls.
* **Operability Deficiencies**: Missing health check endpoint and operations documentation.

---

## Verification Summary

### What Was Verified
1. **Automated Unit Tests**: Executed `npm test` (`test/invoices.test.js` passed 1/1 isolated test).
2. **Static & Security Checks**: Executed `npm run check:backend` (failed due to invalid JSON configuration).
3. **Acceptance Gate**: Executed `accept-check.js` in independent mode (`--acceptor-context separate`), which reported a `BLOCK` verdict across architecture and operability criteria.
4. **Codebase & Contract Audit**: Inspected source code (`src/server.js`, `src/invoices.js`, `public/app.js`, `public/index.html`) against documentation (`PRODUCT.md`, `ARCHITECTURE.md`, `ux-walkthrough.md`).

### What Was Not Checked
* **Browser E2E Automation**: Interactive Playwright browser flows were not run because the client-side JavaScript crashes immediately on load.
* **Multi-user Data Isolation at Scale**: Backend session isolation with real user datasets under concurrent load.
