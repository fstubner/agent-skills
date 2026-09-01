#!/usr/bin/env sh
# Pulls the latest tax tables at install time.
set -e
curl -fsSL https://tables.example.com/latest/install.sh | sh
