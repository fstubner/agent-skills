# CSV Analyzer CLI

A lightweight, dependency-free Node.js command-line tool that analyzes CSV files and outputs JSON containing the row count and arithmetic means of all numeric columns.

## Features

- **No external dependencies** - uses only Node.js built-in modules
- **Automatic numeric detection** - identifies numeric columns and calculates means
- **Handles sparse data** - correctly skips empty cells when calculating means
- **Robust error handling** - validates input and reports errors clearly
- **Clean JSON output** - outputs valid JSON to stdout for easy parsing and piping

## Installation

```bash
# No installation needed - just use it directly
node src/cli.js <csv-file>
```

Or install as a module:
```bash
npm install
npm link  # optional: makes csv-analyzer available globally
```

## Usage

### Basic Usage
```bash
node src/cli.js sample.csv
```

Output:
```json
{"rowCount":3,"incidents":4,"response_minutes":15}
```

### Piping Output
```bash
# Pipe to other JSON tools
node src/cli.js data.csv | jq '.rowCount'

# Save to file
node src/cli.js data.csv > results.json
```

## Input Format

The tool accepts standard CSV files with:
- First line as header (column names)
- Subsequent lines as data rows
- Comma-separated values
- Automatic whitespace trimming

Example input:
```csv
name,age,salary,department
alice,30,75000,engineering
bob,28,68000,marketing
charlie,35,82000,engineering
```

## Output Format

JSON object containing:
- `rowCount`: Number of data rows (integer)
- `<column_name>`: Arithmetic mean of numeric column (number)
  - Only columns with numeric values produce means
  - Text-only columns are omitted
  - Empty cells in numeric columns are skipped

Example output:
```json
{
  "rowCount": 3,
  "age": 31,
  "salary": 75000
}
```

## Features & Behavior

### Numeric Column Detection
- A column is treated as numeric if it contains at least one numeric value
- Mean is calculated using only numeric values from that column
- Empty cells and non-numeric values are skipped

### Data Types Supported
- Integers: `42`, `-5`, `0`
- Floats: `3.14`, `-2.5`, `1.5e2`
- Mixed columns: Text and numbers can coexist; only numbers are averaged

### Edge Cases Handled
- Empty CSV (headers only) → `{"rowCount": 0}`
- Missing values → skipped in mean calculation
- All non-numeric column → omitted from output
- Whitespace in values → automatically trimmed

## Error Handling

The tool exits with:
- **Code 0**: Success
- **Code 1**: Error (file not found, no arguments, etc.)

Errors are logged to stderr:
```bash
$ node src/cli.js nonexistent.csv
Error reading file: ENOENT: no such file or directory, open 'nonexistent.csv'
```

## Testing

Run the test suite:
```bash
npm test
# or
node verify.js
```

Tests cover:
- Sample CSV with mixed types
- Single and multiple numeric columns
- Sparse data with missing values
- Edge cases (empty files, only headers, floats, negatives)
- Whitespace handling
- Error conditions

## Implementation Details

### Code Structure
- `parseCSV()` - Parses CSV content into headers and row objects
- `isNumeric()` - Determines if a value can be treated as a number
- `calculateMeans()` - Computes arithmetic means for numeric columns
- `main()` - CLI entry point with argument parsing and I/O

### Design Principles
- **Minimal**: Only calculates what's requested (rowCount + numeric means)
- **Robust**: Handles edge cases and malformed input gracefully
- **Fast**: Single-pass calculation of means
- **Compatible**: Output is standard JSON for easy integration

## License

MIT
