# CSV Analyzer CLI Implementation

## Overview
A dependency-free Node.js CLI tool that accepts a CSV file path and outputs JSON containing:
- `rowCount`: The number of data rows (excluding header)
- Numeric column means: For each numeric column, the arithmetic mean of all numeric values

## Architecture

### Core Functions

#### `parseCSV(content)`
- Splits input by newlines, filters empty lines
- First line is treated as headers
- Remaining lines are data rows
- Values are stored in objects keyed by header, with proper whitespace trimming

#### `isNumeric(value)`
- Returns true only if value can be converted to a number
- Handles empty strings, null, undefined (returns false)
- Uses `Number()` conversion and `isNaN()` check

#### `calculateMeans(headers, rows)`
- Iterates through each header/column
- Collects all numeric values from that column
- If column has any numeric values, calculates mean
- Columns with no numeric values are omitted from output

#### `main()`
- Validates command-line arguments (requires CSV path)
- Reads file with error handling
- Calls parseCSV and calculateMeans
- Outputs JSON to stdout
- Exits with code 1 on error, 0 on success

## Usage
```bash
node src/cli.js <path-to-csv>
```

Example:
```bash
node src/cli.js sample.csv
# Output: {"rowCount":3,"incidents":4,"response_minutes":15}
```

## Design Decisions

1. **Numeric Detection**: Any value that can be parsed as a number is treated as numeric. Mixed columns (some text, some numbers) are supported - only numeric values contribute to the mean.

2. **Missing Values**: Empty cells are skipped in mean calculations. Only non-empty numeric values are included.

3. **Error Handling**: File read errors are caught and reported. Exit code is set appropriately for scripting.

4. **Output Format**: JSON is output to stdout without any prefix/suffix, making it easy to pipe or parse by other tools.

## Verified Behavior

✓ Parses CSV with headers and data rows correctly
✓ Calculates correct means for numeric columns
✓ Ignores non-numeric columns
✓ Handles missing/empty values correctly
✓ Supports floats and negative numbers
✓ Whitespace is trimmed from headers and values
✓ File not found errors are handled gracefully
✓ Empty CSV (headers only) returns rowCount: 0
✓ Works with sample.csv (3 rows, incidents mean = 4, response_minutes mean = 15)
✓ Multiple numeric columns are handled independently
