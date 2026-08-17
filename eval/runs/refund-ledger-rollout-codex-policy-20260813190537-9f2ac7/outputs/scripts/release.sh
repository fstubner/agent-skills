#!/usr/bin/env bash
set -euo pipefail

npm test
npm run build
sha256sum dist/refund-ledger.tar.gz > dist/refund-ledger.tar.gz.sha256
echo "Built immutable artifact: dist/refund-ledger.tar.gz"
