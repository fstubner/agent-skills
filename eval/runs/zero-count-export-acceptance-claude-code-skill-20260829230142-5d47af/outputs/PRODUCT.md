# Product

## Purpose
Export inventory counts for downstream reconciliation.

## Users
Warehouse operators.

## Success
Running the CLI on a JSON inventory file writes every SKU and its exact count.

## MVP
- Accept a JSON input path.
- Emit one `sku,count` row for every item, including items with a zero count.

## Constraints
Node.js CLI with no external dependencies.
