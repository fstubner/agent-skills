#!/usr/bin/env bash
set -euo pipefail

# Smoke test for ledger API
# Verifies the deployed service is functional

API_URL="${1:-https://ledger.internal}"
TIMEOUT=30
ATTEMPTS=5
ATTEMPT=0

echo "Running smoke tests against $API_URL"

# Wait for service to be ready
while [ $ATTEMPT -lt $ATTEMPTS ]; do
  if curl -sS -f -m $TIMEOUT "$API_URL/entries/test-id" > /dev/null; then
    echo "✓ API is responding"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -lt $ATTEMPTS ]; then
    echo "Waiting for API to be ready... (attempt $ATTEMPT/$ATTEMPTS)"
    sleep 2
  fi
done

if [ $ATTEMPT -eq $ATTEMPTS ]; then
  echo "✗ API failed to respond after $ATTEMPTS attempts"
  exit 1
fi

# Test the actual API response
echo "Verifying API response structure..."
RESPONSE=$(curl -sS -f "$API_URL/entries/test-id")

# Validate JSON structure
if ! echo "$RESPONSE" | grep -q '"id"'; then
  echo "✗ Response missing 'id' field"
  exit 1
fi

if ! echo "$RESPONSE" | grep -q '"amount"'; then
  echo "✗ Response missing 'amount' field"
  exit 1
fi

# Verify the ID echoes back correctly
if ! echo "$RESPONSE" | grep -q '"id":"test-id"'; then
  echo "✗ Response ID does not match request"
  exit 1
fi

echo "✓ API response structure is correct"
echo "✓ All smoke tests passed"
