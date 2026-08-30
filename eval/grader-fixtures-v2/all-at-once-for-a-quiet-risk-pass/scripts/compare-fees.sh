#!/usr/bin/env bash
# compare-fees.sh --canary-only --max-disagreement-bps <n>
#
# Sums the fees this service charged in the last window against what the
# payment processor settled, and exits non-zero when they disagree by more than
# the given tolerance. `--canary-only` restricts the comparison to invoices
# served by pods running the canary image.
set -euo pipefail
echo "comparing settled fees against charged fees: $*"
curl --fail --silent --show-error \
  "https://reconciliation.internal/fee-disagreement?window=5m&$(printf '%s' "${*// /&}")"
