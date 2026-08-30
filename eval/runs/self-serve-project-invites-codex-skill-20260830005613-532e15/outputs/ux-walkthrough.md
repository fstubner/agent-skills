# UX walkthrough

Primary job: create a project invitation link.

1. Open `/`; the page shows a labeled project, account, email, and access-level form. Empty required fields prevent submission.
2. Enter `demo`, `admin@example.com`, an email, choose Viewer or Editor, and submit. A live status announces progress, then a focusable shareable link appears.
3. If authentication, authorization, or validation fails, the live status shows a human-readable error and the form remains usable.
4. Submit again with the same request key; the server returns the original invite. Refreshing before submission leaves no server mutation; refresh after success does not claim a new invite.
