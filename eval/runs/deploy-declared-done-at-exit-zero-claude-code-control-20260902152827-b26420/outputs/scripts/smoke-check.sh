#!/usr/bin/env bash
set -euo pipefail

# Smoke check validates the deployed API responds correctly
URL="${1:-https://ledger.internal/entries/smoke}"

echo "Smoke checking: $URL"

RESPONSE=$(curl -sS "$URL")
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "FAIL: Could not connect to endpoint"
  exit 1
fi

# Validate response has required fields
if ! echo "$RESPONSE" | grep -q '"id"'; then
  echo "FAIL: Response missing 'id' field"
  echo "Response: $RESPONSE"
  exit 1
fi

if ! echo "$RESPONSE" | grep -q '"amount"'; then
  echo "FAIL: Response missing 'amount' field"
  echo "Response: $RESPONSE"
  exit 1
fi

# Validate it's valid JSON
if ! echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "FAIL: Response is not valid JSON"
  echo "Response: $RESPONSE"
  exit 1
fi

# Validate amount is a number (not null or string "0")
AMOUNT=$(echo "$RESPONSE" | jq '.amount')
if ! [[ "$AMOUNT" =~ ^-?[0-9]+\.?[0-9]*$ ]]; then
  echo "FAIL: 'amount' field is not a number"
  echo "Amount value: $AMOUNT"
  exit 1
fi

echo "PASS: Endpoint is healthy and responsive"
