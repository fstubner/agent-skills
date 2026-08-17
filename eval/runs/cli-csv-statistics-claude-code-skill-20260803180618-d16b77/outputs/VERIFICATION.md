# CLI Verification

## Implementation Summary

The CLI at `src/cli.js` implements the following:

### Features
1. **Argument Parsing**
   - Accepts a single CSV file path as positional argument
   - Supports `--help` / `-h` to show usage
   - Supports `--version` / `-v` to show version
   - Rejects unknown flags with helpful error message
   - Shows usage when no arguments provided

### CSV Processing
1. **Parsing**: Splits CSV by newlines and commas, trims whitespace
2. **Row Handling**: Skips empty lines, handles varying column counts
3. **Type Detection**: Identifies numeric columns by parsing values as numbers
4. **Mean Calculation**: Only includes valid numeric values (skips empty strings, non-numeric text)

### Output
- Machine-readable JSON on stdout (per CLI skill requirement)
- Errors on stderr
- Exit code 0 on success, 1 on failure
- JSON structure: `{ rowCount: N, columnName: mean, ... }`

## Manual Test Walkthrough

### Test Case 1: sample.csv
Input:
```csv
team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15
```

Processing:
- Headers: team, incidents, response_minutes
- Rows: 3 data rows
- Numeric columns: incidents, response_minutes
- incidents means: (3 + 5 + 4) / 3 = 12 / 3 = 4
- response_minutes means: (12 + 18 + 15) / 3 = 45 / 3 = 15
- team is non-numeric, not included in output

Expected Output:
```json
{"rowCount":3,"incidents":4,"response_minutes":15}
```

### Test Case 2: Mixed Types (mixed.csv)
Input:
```csv
name,age,score
alice,25,85.5
bob,30,92
charlie,22,78.5
```

Expected Output:
```json
{"rowCount":3,"age":25.666666666666668,"score":85.33333333333333}
```
- name is all strings, excluded
- age: (25 + 30 + 22) / 3 = 77 / 3 ≈ 25.67
- score: (85.5 + 92 + 78.5) / 3 = 256 / 3 ≈ 85.33

### Test Case 3: Error Handling

**File not found**
- CLI exits with code 1
- Error message: "Error: File not found: <path>"

**No arguments**
- CLI exits with code 1
- Prints usage to stderr

**Headers only (no data)**
- CLI exits with code 1
- Error message: "Error: CSV file has no data rows"

## CLI Contract Compliance

✓ Exit codes properly used (0=success, 1=failure)
✓ Machine-readable output on stdout
✓ Errors on stderr
✓ Supports --help and --version flags
✓ No interactive prompts (CI-safe)
✓ Handles edge cases: empty values, mixed types, negative numbers, decimals
✓ Idempotent (same input = same output)
✓ No dependencies beyond Node.js stdlib
✓ Clear error messages
✓ Positional argument for required CSV path

## Key Implementation Details

### Numeric Detection (isNumeric function)
- Returns false for empty strings
- Uses `Number(value)` to parse
- Checks for `!isNaN(num) && isFinite(num)` to exclude NaN and Infinity

### Mean Calculation (calculateMeans function)
- Iterates through all headers
- For each column, filters only numeric values
- Only includes mean in output if column has at least one numeric value
- Skips entirely non-numeric columns

### Edge Cases Handled
1. Empty CSV cells → treated as non-numeric
2. All non-numeric columns → included in output with rowCount only
3. Mixed numeric/non-numeric in same column → only numeric values counted
4. Single row → mean equals the value itself
5. Decimal numbers → preserved in arithmetic
6. Negative numbers → correctly handled

## Testing Approach

The test.js file includes 12 comprehensive test cases:
1. Basic numeric columns
2. Mixed string and numeric
3. Single row
4. Empty string values
5. Non-numeric column exclusion
6. Negative numbers
7. File not found error
8. Help flag
9. Version flag
10. No arguments usage
11. Decimal numbers
12. Headers-only error

Each test:
- Creates a test CSV file
- Runs the CLI against it
- Validates exit code and output
- Cleans up test files
