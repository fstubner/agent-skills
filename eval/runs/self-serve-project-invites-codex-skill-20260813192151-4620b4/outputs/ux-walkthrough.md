# UX walkthrough

## Primary job: create a shareable invite link

1. Open the page; a heading, no-email-delivery explanation, and labeled form appear. Empty state is the untouched form.
2. Enter account name, project ID, email, and Viewer or Editor; browser required/type validation identifies missing or malformed fields.
3. Submit; the browser sends the account as a Bearer header and displays a live success message containing a focusable invite link. The form remains available for another invite.
4. Submit with a non-admin account or invalid server data; a live error message states the server-provided human message and no link appears.
5. Refresh mid-flow; transient values are cleared and no invite result is claimed. Retrying the same API key is server-idempotent.
