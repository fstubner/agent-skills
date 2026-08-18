# Payments worker

Charges are retried until they succeed, so a transient card processor outage
never loses revenue. The worker is idempotent and safe to run on several
machines at once. `pytest` covers the retry path.
