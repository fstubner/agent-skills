#!/bin/bash
set -e

ENVIRONMENT=${1:-development}
IMAGE=${2:-ledger-api:latest}

echo "Deploying ledger-api to $ENVIRONMENT"
echo "Image: $IMAGE"
echo "✓ Deployment script executed"
