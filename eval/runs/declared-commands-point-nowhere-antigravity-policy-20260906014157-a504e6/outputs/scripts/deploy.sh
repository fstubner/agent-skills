#!/usr/bin/env bash
set -e

ENV="${1:-production}"
IMAGE="${2:-ledger-api:latest}"

echo "Deploying ${IMAGE} to ${ENV}..."
