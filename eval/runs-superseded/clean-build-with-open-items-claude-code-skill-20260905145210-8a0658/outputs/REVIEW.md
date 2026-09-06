# Room Booking Tool — Acceptance Review

**Verdict: BLOCK**

## Gate Status

The acceptance gate cannot be run because the core libraries (`core/lib/*`) required by `accept-check.js` are not vendored into the `.agent-input/product-acceptance/scripts/vendor/` directory. The script fails with a missing core resolver. **Status: not_evaluated**

## Walkthrough Status

The ux-walkthrough cannot be executed because the application is non-functional. Three critical, blocking issues prevent the feature from working at all.

## Critical Issues (Blocking)

### 1. Missing Static File Serving
**File**: `src/server.js` (no static middleware added)
**Status**: CONFIRMED BLOCKING

The Express server creates the app but does not serve static files:
```javascript
// Missing: app.use(express.static('public'))
```

The `public/index.html` file exists but is not accessible. When users navigate to the application, they receive no HTML response—no UI can be rendered. The Success criterion "A member of staff can book a free room for a slot... without walking to the door" requires a functional UI, which is not provided.

### 2. Missing Client-Side Code
**File**: `public/index.html` and no client-side scripts in the project
**Status**: CONFIRMED BLOCKING

The HTML file is a stub:
```html
<!doctype html><title>Room booking</title><main id="app"></main>
```

- No script references or inline JavaScript
- No framework bundle (React, Vue, vanilla, etc.)
- The `#app` element cannot be populated; there is no code to render sign-in, booking form, list, or cancellation UI
- No way to make API calls from the client
- No implementation of the stated ux-walkthrough steps: sign in, book, list bookings, cancel, sign out

The entire frontend is missing. No scope of this application's MVP can be completed: the user cannot sign in, book a room, list bookings, or cancel a booking because there is no UI.

### 3. Session Cookie Configuration Issue
**File**: `src/server.js`, line 23
**Status**: CONFIRMED BLOCKING

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```

The `secure: true` flag means cookies will only be sent over HTTPS connections. In development and testing:
- The app runs on `http://localhost:3000` (HTTP, not HTTPS)
- Browsers will not send the session cookie on HTTP
- The `/api/bookings`, `/api/bookings` (POST), and `/api/bookings/:id` (DELETE) endpoints will all return `401 Unauthorized` because `req.session.staffId` will be undefined
- The primary job is blocked: users cannot make authenticated requests

**Fix required**: Change `secure` to evaluate based on environment:
```javascript
secure: process.env.NODE_ENV === 'production'
```

Or deploy to an HTTPS-only environment.

## What Was Not Checked

Because the application is non-functional, the following parts of the review could not be performed:

- **A — Contract (Adversarial Checklist)**: Could not verify the Success condition "book a free room for a slot" because the UI does not exist and the session configuration blocks authenticated requests
- **B — Primary Path**: Could not replay the ux-walkthrough steps (sign in, book, list, cancel) because there is no client-side code
- **C — Empty/Error/Loading States**: Could not test error handling, loading indicators, or empty states because there is no UI to observe
- **D — Input Validation Against Malicious Input**: The backend validation in `validate.js` is correct, but it cannot be reached from the UI due to missing static serving and client code
- **Gate Report**: The accept-check.js gate cannot run without the vendored core libraries

## Code Quality (Where Assessed)

The backend code that exists is well-written:
- `validate.js` correctly validates room, slot (half-hour between 08:00–17:30), and attendee count (1–20)
- `bookings.js` correctly prevents double-booking and filters bookings by staff ID
- `server.js` correctly enforces the `requireStaff` middleware on protected endpoints
- Test suite covers the happy path and constraint checks; all 9 tests pass
- Authorization checks correctly prevent users from canceling others' bookings

However, code quality is irrelevant to a non-functional product.

## Conclusion

The room booking tool is **not ready for release**. The backend API is correctly implemented, but the entire frontend is missing, and a critical session configuration issue prevents any authenticated requests from working. The application cannot fulfill any part of the stated MVP:

- ✗ Staff cannot book a room (no UI)
- ✗ Staff cannot list their bookings (no UI)
- ✗ Staff cannot cancel a booking (no UI)
- ✗ Sessions do not work on HTTP (secure cookie issue)

**Do not deploy this product.** Before next acceptance, provide:

1. A complete, working client-side implementation in `public/` (with script references or inline code in `index.html`)
2. Add `app.use(express.static('public'))` to `src/server.js`
3. Fix the session cookie `secure` flag to work on HTTP during development

The office manager cannot replace the paper sheets with this application; it will not function.
