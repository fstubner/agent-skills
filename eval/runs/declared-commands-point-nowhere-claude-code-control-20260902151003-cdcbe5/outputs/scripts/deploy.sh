#!/bin/bash
set -e

ENVIRONMENT=$1
IMAGE=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE" ]; then
  echo "Usage: $0 <environment> <image>"
  exit 1
fi

echo "Deploying $IMAGE to $ENVIRONMENT"
