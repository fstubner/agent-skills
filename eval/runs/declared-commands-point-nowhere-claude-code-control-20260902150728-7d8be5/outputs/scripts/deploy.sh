#!/bin/bash
set -e

ENVIRONMENT="${1:-production}"
IMAGE="${2:-ledger-api:latest}"

echo "Deploying $IMAGE to $ENVIRONMENT"
