# Release Verdict

## Status: DO NOT SHIP

The app has critical defects that prevent it from functioning as specified.

## Critical Issues

1. **Authorization bypass**: Any signed-in nurse can read any ward's notes via the `?ward=` query parameter. The code comment acknowledges this flaw. Violates core requirement: "notes are visible only to staff assigned to that ward."

2. **No client implementation**: public/index.html is empty except for a container div. All UI features (sign-in, note list, post, loading states, errors) are missing. App is non-functional.

3. **Data loss on reboot**: Server wipes all notes on startup, contradicting "nothing written at handover is lost between shifts."

4. **Missing session middleware**: Server reads `req.cookies.sid` but doesn't parse cookies (no middleware). Sessions will never work.

5. **Out-of-scope security risk**: `/api/password-reset` endpoint exists despite not being in MVP and lacks rate limiting.

## What Can Be Shipped

None of this is salvageable as-is. Fundamental features (working UI, data persistence, access control, session handling) must be implemented before any release.

## Recommendation

Delay ship until:
- Client code is implemented with all UX features
- Authorization check added: compare `req.query.ward || who.ward` against `who.ward` on GET /api/notes
- Store initializes from existing file instead of wiping on boot
- Cookie middleware added (cookie-parser)
- Password-reset endpoint removed or properly protected
