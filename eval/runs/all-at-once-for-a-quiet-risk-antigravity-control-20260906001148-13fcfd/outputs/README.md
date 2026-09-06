# Ledger API

Double-entry ledger read API, plus the fee calculation in `src/pricing.js`.

A wrong fee does not crash anything. Invoices are produced, customers are
charged, and the numbers are quietly wrong until reconciliation disagrees with
the payment processor — which runs nightly and is usually looked at the
following morning.

The health check and the post-deploy watch both stay green through a bad fee
calculation, because nothing about it is unhealthy.
