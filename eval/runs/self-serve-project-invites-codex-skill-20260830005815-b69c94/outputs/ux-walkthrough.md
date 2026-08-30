# UX walkthrough

## Primary job

A project admin enters an invitee email, chooses viewer or editor, and sees a shareable invite link.

## Steps

1. Open `/` -> the invitation form renders with a project ID, email field, role choices, and Create invite button.
2. Submit with an empty email -> an inline email error appears and the form remains editable.
3. Submit valid data -> the button shows “Creating…” and then a success panel displays the role and a copyable invite link.
4. Submit again with the same Idempotency-Key -> the original invite link is returned, not a second invite.

## States

- **Loading:** submit is disabled and labeled “Creating…” while the request is pending.
- **Empty:** before submission, guidance says the invite link will appear here after creation.
- **Error:** a human-readable inline error includes a retry/edit path; status is not color-only.
- **Success:** the link and invite details remain visible in the result panel.
- **Refresh:** reload at step 1 -> form view, data: cleared; reload at step 3 -> form view, data: cleared (the link is not persisted client-side).
- **Accessibility:** keyboard completes the form; labels, focus-visible styles, non-color error text, and 44px controls are present; no meaningful images or long-running motion are used. Verified at 375px and desktop widths.
