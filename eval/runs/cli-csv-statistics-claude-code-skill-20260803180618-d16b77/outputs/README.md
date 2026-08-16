# CSV Analyzer CLI

A dependency-free Node.js command-line tool that analyzes CSV files and outputs JSON with row count and arithmetic means of numeric columns.

## Usage

```bash
node src/cli.js <csv-path>
```

### Examples

```bash
# Analyze sample CSV
node src/cli.js sample.csv

# Get help
node src/cli.js --help

# Get version
node src/cli.js --version
```

## Output Format

The CLI outputs a JSON object with:
- `rowCount`: The total number of data rows in the CSV
- Column means: For each numeric column, the arithmetic mean value

Non-numeric columns are excluded from the output (except rowCount).

### Example

Input CSV (sample.csv):
```csv
team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15
```

Output:
```json
{"rowCount":3,"incidents":4,"response_minutes":15}
```

## Features

### For Humans (CLI Surface)
- Clear usage message with `--help`
- Version info with `--version`
- Usage printed when called with no arguments
- Helpful error messages for missing or invalid files

### For Machines (Exit Codes & Output)
- Exit code 0 on success
- Exit code 1 on any error
- Machine-readable JSON on stdout only
- All errors and messages on stderr
- Idempotent: same input always produces same output
- No interactive prompts (CI-safe)
- No network calls
- No external dependencies

## Error Handling

The CLI gracefully handles:
- **File not found**: Exits with code 1 and error message
- **CSV parse errors**: Exits with code 1 with error details
- **Empty CSV**: Exits with code 1 (headers only, no data)
- **Malformed arguments**: Shows usage and exits with code 1

## Implementation Details

### CSV Parsing
- Splits input by newlines and commas
- Trims whitespace from headers and values
- Handles empty lines gracefully
- Supports values with internal commas (basic CSV format)

### Numeric Detection
A value is considered numeric if:
- It's not an empty string
- `Number(value)` is not NaN
- The value is finite (not Infinity or -Infinity)

Examples:
- ✓ "123", "-456", "3.14", "0"
- ✗ "", "abc", "Infinity", "NaN"

### Mean Calculation
- For each column, identifies all numeric values
- Skips empty strings and non-numeric entries
- Calculates sum / count
- Only includes column in output if it has at least one numeric value

## Testing

### Test Suite
Run the comprehensive test suite:
```bash
node test.js
```

This runs 12 test cases covering:
- Basic numeric columns
- Mixed string and numeric data
- Single row datasets
- Empty cell handling
- Non-numeric column filtering
- Negative numbers
- File not found errors
- Help and version flags
- No-argument usage
- Decimal numbers
- Headers-only CSV files

### Logic Verification
Test the core parsing and calculation logic:
```bash
node verify-logic.js
```

This verifies:
- CSV parsing correctness
- Mean calculations
- Numeric detection
- Edge cases (empty values, negatives, decimals)

## Architecture

### src/cli.js
Main entry point with:
- `parseArgs()`: Handles command-line arguments and flags
- `parseCSV(content)`: Parses CSV content into headers and rows
- `isNumeric(value)`: Determines if a value is numeric
- `calculateMeans(headers, rows)`: Computes means for numeric columns
- `main()`: Orchestrates file reading and output

### Key Design Decisions

1. **No Dependencies**: Uses only Node.js built-in modules (fs, path)
2. **Synchronous I/O**: Simpler for CLI tools; file reading is typically fast
3. **Trimmed Values**: All CSV values are trimmed to handle spacing
4. **Column Order**: Output preserves header order from input CSV
5. **Early Exit**: Validates file existence before processing

## Compliance with CLI Best Practices

✓ **User-Facing Surface**
  - Verb-noun consistent commands (not applicable, single command)
  - Common case needs no flags (just: `cli <path>`)
  - Clear help text and version
  - Non-interactive (no prompts blocking CI)

✓ **Machine-Facing Contract**
  - Explicit exit codes (0=success, 1=failure)
  - Machine-readable output on stdout
  - Errors on stderr
  - Idempotent re-runs
  - Clear, actionable error messages
  - Positional argument for required path
  - No default targets (requires explicit CSV path)

## Edge Cases Handled

1. **Empty Cells**: `a,,c` - Empty middle cell skipped in mean calculation
2. **All Non-Numeric Column**: Column excluded from output
3. **Mixed Column**: Column with some numeric, some text - only numeric values counted
4. **Single Row**: Mean equals the value itself
5. **Negative Numbers**: Correctly handled in arithmetic
6. **Very Large Numbers**: No limits on numeric magnitude
7. **Decimal Precision**: Maintains JavaScript floating-point precision
8. **Blank Lines**: Skipped during parsing
9. **Extra Trailing Comma**: Handled gracefully (creates empty value)

## Example Use Cases

### Data Analysis Pipeline
```bash
# Extract numeric statistics from CSV
node src/cli.js data.csv | jq '.incidents'
```

### CI/CD Integration
```bash
# Validate metrics in automated pipeline
node src/cli.js metrics.csv | jq '.errorRate < 0.05'
```

### Batch Processing
```bash
# Process multiple CSV files
for file in data/*.csv; do
  echo "Processing $file:"
  node src/cli.js "$file"
done
```
