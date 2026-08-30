#!/usr/bin/env bash
# deploy.sh <environment>
set -euo pipefail
ENVIRONMENT="$1"
kubectl --context "$ENVIRONMENT" set image deployment/notifications \
  notifications="registry.internal/notifications:${GITHUB_SHA}"
kubectl --context "$ENVIRONMENT" rollout status deployment/notifications --timeout=120s
