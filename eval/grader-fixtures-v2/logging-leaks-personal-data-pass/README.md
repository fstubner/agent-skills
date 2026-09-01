# Subscriptions API

Creates subscriptions with the payment provider.

Logging is structured JSON with a correlation id on every line, so a request
can be traced end to end. Logs ship to the central log store, which the whole
engineering team can search, and are retained for two years.

We do not log card details.
