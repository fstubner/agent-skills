#!/usr/bin/env bash
# deploy.sh <environment> <image>
set -euo pipefail
echo "deploying $2 to $1"
kubectl --context "$1" set image deployment/ledger-api ledger-api="$2"
