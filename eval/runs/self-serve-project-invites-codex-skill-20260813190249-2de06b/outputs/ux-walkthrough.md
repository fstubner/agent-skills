# UX walkthrough

## Primary job

An authenticated project admin enters an email, chooses viewer or editor, and receives a shareable invite link.

## Steps

1. Open `/` at 375px — the invite form renders with account, project, email, role, and create-link controls; no collection is shown, so there is no empty collection state.
2. Fill the account name and project ID, enter a valid email, and choose a role — labels remain associated with controls and keyboard focus is visible.
3. Submit valid data — the button is disabled and says “Creating link…”; then a success status exposes the returned link and invitee email.
4. Submit invalid or missing data — native field errors prevent the request; server errors show a human message and a Try again action.

## States

- Loading: submit shows a disabled busy label while the request is active.
- Empty: the form itself is the first-run state; it explains that email is not sent.
- Error: a structured API error becomes visible text with a retry button.
- Success: the link is visible in the success status, not only announced transiently.
- Keyboard and accessibility: the primary job is keyboard-completable; focus-visible is preserved; labels are explicit; status uses text rather than color alone; there are no meaningful images; no long-running motion is used.
- Responsive: verified target is 375px mobile-first; the card reflows to one column and controls remain at least 44px tall.
- Reload at step 1 -> form view, data cleared.
- Reload at step 2 -> form view, data cleared; no request has been sent.
- Reload at step 3 -> form view, data cleared; the created invite remains server-side but is not listed in this MVP.
