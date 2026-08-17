# Neighbourhood Tool Library — Product Contract

## 1. Product decision

Build a private, invite-only web application for one neighbourhood association to lend household tools between residents. The first release is successful when an authenticated resident can find an available tool, submit a request, and the tool owner can accept it. A completed loan can then be marked returned. Association volunteers can resolve disputes.

This contract defines the smallest release that can be designed and built in one month. Product, design, and engineering should treat anything outside this document as out of scope unless it is added through an explicit change.

## 2. Users and permissions

### Resident

An approved resident can:

- Sign in and manage their profile.
- Add, edit, pause, and remove their own tools.
- Browse tools shared within the association.
- Request an available tool, including a short note and intended pickup/return dates.
- Cancel their own pending request.
- Accept or decline requests for their own tools.
- Mark a loan returned when the tool is back with the owner.
- Report a problem with a loan to volunteers.
- See the status and history of their own requests, loans, and tools.

### Volunteer

A volunteer has all resident permissions and can:

- View all requests, active loans, and reported problems in the association.
- Change a request or loan status when resolving an operational issue.
- Record a dispute outcome and an internal resolution note.
- Remove or hide a listing that is unsafe, inappropriate, or no longer valid.
- Suspend access for a resident. Suspension prevents new activity but preserves records needed to resolve existing loans.

The first release has one volunteer role; do not build a multi-level administration system.

## 3. Core rules

1. The service is private to approved association members. There is no anonymous browsing, public catalogue, public profile, or search-engine indexing.
2. A tool is requestable only when its listing is active and it has no active or accepted loan covering the requested period.
3. A request does not reserve a tool. The owner must accept it before a loan exists.
4. Only one accepted loan may exist for a tool at a time. Engineering must enforce this on the server, including when two residents request concurrently.
5. The owner controls acceptance and decline. The requester controls cancellation while a request is pending.
6. A loan is considered complete only when the owner marks it returned, or a volunteer closes it during dispute resolution.
7. Contact details are not shown in the catalogue. They are revealed only to the owner and requester after a request is accepted, so they can arrange handoff outside the product.
8. No money, delivery, deposits, identity-document collection, or background checks are part of this release.
9. Store and process product data in the European Union. The deployment and any managed services selected by engineering must support EU-only storage and processing for this product.
10. Use least-privilege access. Residents may access only their own private records plus catalogue fields and accepted-loan contact details needed for a handoff.

## 4. Primary user journeys

### 4.1 Join and sign in

1. A volunteer invites a resident using their email address.
2. The resident opens the single-use invite link, sets a password, and confirms their display name and neighbourhood membership.
3. The resident signs in and lands on the catalogue.
4. A suspended or revoked account cannot sign in to create activity; it sees a clear support message.

For the MVP, use email invite plus password authentication. Email verification and password reset are required. Social login is not required.

### 4.2 List a tool

1. Resident selects “List a tool”.
2. Required fields: tool name, category, short description, condition, and availability status.
3. Optional fields: photo, brand/model, usage or safety notes, and preferred handoff notes.
4. Resident saves the listing as active or paused.
5. Active listings appear to approved residents; paused listings remain visible to the owner but cannot be requested.

The form must warn the owner not to list dangerous, illegal, or broken items and must provide a way to report/remove a listing. The product does not certify tool safety; the owner remains responsible for the item and handoff.

### 4.3 Request an available tool

1. Resident searches or filters the private catalogue by name/category and opens a tool detail page.
2. The detail page shows the tool name, photo if present, description, condition, availability status, owner display name, safety notes, and any existing availability dates. It does not show the owner’s email or phone number.
3. Resident selects requested pickup date and expected return date and enters an optional note.
4. The system validates that the return date is on or after pickup and that the tool is still requestable.
5. Resident confirms. The request is created as `Pending` and the owner is notified.
6. If the tool became unavailable before confirmation, the request is rejected with a recoverable message and the resident remains on the detail page.

The request form must display the owner’s expected response time if configured; this is informational only and is not a service-level promise.

### 4.4 Owner accepts or declines

1. Owner opens the request from their dashboard or notification.
2. Owner sees requester display name, requested dates, note, and the tool details.
3. Owner accepts or declines.
4. On accept, the request becomes `Accepted`, an active loan is created, the tool becomes unavailable for overlapping requests, and both parties receive the other party’s agreed contact details.
5. On decline, the request becomes `Declined`; no contact details are shared and the tool remains requestable if active.

If an owner does not respond, a pending request remains pending until the requester cancels or a volunteer closes it. Volunteers may configure or apply an operational reminder, but automatic expiry is not required for the first release.

### 4.5 Return a loan

1. Either party can open the active loan and choose “Report return” when the tool has been handed back.
2. The other party receives a confirmation request.
3. The loan becomes `Returned` only when the owner confirms, or a volunteer closes it.
4. The tool becomes available again if its listing is still active.

If the parties disagree, either can report a problem instead of confirming. The loan becomes `Disputed`, remains unavailable, and appears in the volunteer queue.

### 4.6 Resolve a dispute

1. Volunteer opens the dispute queue and sees the tool, parties, dates, description, and report history.
2. Volunteer may message the parties using the product’s existing notification/contact mechanism, record an internal note, and choose an outcome.
3. Outcomes are: close as returned, keep loan active, cancel loan, or hide the tool listing.
4. The volunteer records the outcome and a required resolution note. The system records who resolved it and when.
5. The affected parties receive a status notification. Internal notes are visible only to volunteers.

## 5. Status model

### Tool listing

- `Active`: visible and requestable when no accepted loan blocks the dates.
- `Paused`: visible to owner only; not requestable.
- `On loan`: visible in the catalogue as unavailable; not requestable.
- `Removed`: not visible to residents; retained for audit/history.

### Request

- `Pending` → `Accepted`, `Declined`, `Cancelled`, or `Closed by volunteer`.
- Only the owner can accept/decline; only the requester can cancel; volunteers can close any request.
- An accepted request creates exactly one loan.

### Loan

- `Active` → `Return reported`, `Returned`, or `Disputed`.
- `Return reported` → `Returned` after owner confirmation, or `Disputed` after either party reports a problem.
- `Disputed` → `Returned`, `Cancelled`, or `Active` by volunteer resolution.
- All terminal transitions retain timestamps and actor identity.

## 6. Required screens

1. Invite acceptance, sign in, password reset, and suspended-account states.
2. Resident catalogue with search, category filter, availability filter, empty state, and unavailable state.
3. Tool detail page with request action and unavailable/request-pending variants.
4. Add/edit tool form with validation, photo upload, pause/remove controls, and safety copy.
5. Resident dashboard with tabs or sections for My requests, My loans, and My tools.
6. Request detail for requester and owner, with role-appropriate actions.
7. Active loan detail with dates, contact details, return/report-problem actions, and status history.
8. Volunteer operations view for pending requests, active loans, disputes, residents, and hidden listings.
9. Dispute detail and resolution form with required internal note.
10. Notifications/inbox or an equivalent notification history so users can find action-required events.

Every screen must define loading, empty, validation-error, permission-denied, not-found, and server-error states where applicable. Destructive actions require confirmation and explain what happens to active requests or loans.

## 7. Notifications

Notify the relevant users for: invitation, request submitted, request accepted, request declined, request cancelled, return reported, return confirmed, dispute opened, dispute resolved, account suspended, and listing hidden/removed.

Notifications must identify the tool, action, actor role, and next action. Email delivery is the MVP default; an in-app notification history is also required. Notification delivery failure must not roll back the underlying state change.

## 8. Data contract

Minimum entities:

- `User`: id, email, display name, role, account status, created/updated timestamps.
- `Invitation`: id, email, inviter, single-use token or equivalent, expiry, accepted/revoked timestamps.
- `Tool`: id, owner id, name, category, description, condition, photo reference, safety notes, handoff notes, listing status, created/updated timestamps.
- `Request`: id, tool id, requester id, pickup date, expected return date, note, status, created/updated timestamps, decision actor/time.
- `Loan`: id, tool id, request id, owner id, borrower id, dates, status, return-report actor/time, closed actor/time.
- `Dispute`: id, loan id, reporter id, reason, status, volunteer resolution, internal note, resolved actor/time.
- `Notification`: id, recipient id, event type, related entity, read/delivered state, created timestamp.

Use immutable event/audit fields for status changes: actor, previous status, new status, and timestamp. Do not store raw passwords, invite tokens, or sensitive contact data in logs. Photo uploads must be access-controlled and stored in an EU region.

## 9. Non-functional requirements

- Responsive web experience usable on current mobile and desktop browsers.
- Server-side authorization for every read and write; client-side hiding is insufficient.
- Concurrent request handling must prevent overlapping accepted loans for the same tool.
- Dates use the association’s configured local timezone and are displayed consistently to all members.
- Keyboard navigation, visible focus, labelled form controls, meaningful error text, and sufficient colour contrast are required for the core journeys.
- Provide basic rate limiting for sign-in, password reset, invite redemption, and request creation.
- Provide export/delete support for a resident’s personal data where operationally feasible, with volunteer access for fulfilment. Retention and deletion periods must be documented before launch.
- Backups, monitoring, error reporting, and analytics must use EU-hosted or EU-restricted services. Do not add third-party tracking or advertising.

## 10. Out of scope for release one

Payments, deposits, delivery, shipping, public browsing, public URLs, ratings/reviews, chat, calendar sync, recurring loans, waitlists, multi-neighbourhood tenancy, social login, automated identity verification, tool safety certification, native mobile apps, recommendation algorithms, and a full compliance certification programme.

## 11. Acceptance criteria

The release is ready when all of the following are true:

1. A volunteer can invite a resident; the resident can accept the invite, sign in, and recover a forgotten password.
2. A resident can create an active tool listing and another approved resident can find it in the private catalogue.
3. A resident can submit a valid request for an available tool and see `Pending` status; the owner receives a notification.
4. The owner can accept or decline. Acceptance creates one active loan and blocks overlapping requests; decline does not reveal contact details.
5. The requester can cancel a pending request, and both parties can see accurate status history.
6. The owner can confirm a reported return, making the loan `Returned` and the tool requestable again.
7. Either party can open a dispute; a volunteer can resolve it with a required internal note, and internal notes are not visible to residents.
8. Suspended users cannot create new listings or requests, and residents cannot access another resident’s private records.
9. The system handles two simultaneous requests without creating two overlapping accepted loans.
10. Core screens have defined empty, loading, error, and permission states; keyboard-only navigation works through the request flow.
11. A deployment review confirms application data, file uploads, backups, and operational telemetry are restricted to the EU.

## 12. Launch assumptions and decisions to confirm

The contract assumes one association, one configured timezone, invite-only membership, email/password authentication, email notifications, owner/requester handoff arranged outside the product, and one volunteer role. Before implementation begins, the association must name the timezone, define who may invite residents, provide the email sender/domain, choose a retention period, and confirm the EU hosting boundary. None of these choices changes the core user journey, but they are required for launch configuration.
