#!/usr/bin/env bash
set -e

ENVIRONMENT="${1:-production}"
IMAGE="${2:-registry.internal/ledger-api:latest}"

echo "Deploying ${IMAGE} to ${ENVIRONMENT}..."
