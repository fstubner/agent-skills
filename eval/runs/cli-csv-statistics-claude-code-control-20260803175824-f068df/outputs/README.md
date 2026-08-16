# CSV Statistics CLI

A dependency-free Node.js command-line tool that analyzes CSV files and outputs statistics.

## Features

- Parses CSV files with automatic header detection
- Counts the number of data rows
- Calculates arithmetic mean for all numeric columns
- Ignores non-numeric columns
- Robust handling of whitespace, empty lines, and mixed data types
- Proper error handling and exit codes

## Installation

```bash
npm install
```

## Usage

```bash
node src/cli.js <path-to-csv>
```

### Example

```bash
node src/cli.js sample.csv
```

Output:
```json
{"rowCount":3,"incidents":4,"response_minutes":15}
```

## Testing

Run the test suite:

```bash
npm test
```

Run edge case tests:

```bash
node test/edge-cases.js
```

## CSV Format

The tool expects a standard CSV format with:
- Headers in the first row
- Data rows following
- Comma-separated values
- Automatic trimming of whitespace

### Example Input

```csv
team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15
```

### Example Output

```json
{
  "rowCount": 3,
  "incidents": 4,
  "response_minutes": 15
}
```

Note: The `team` column is not included because it contains non-numeric values.

## Implementation Details

- **parseCSV**: Splits CSV content by lines and columns, handles whitespace trimming
- **isNumeric**: Determines if a value is a valid number (excludes NaN, Infinity, empty strings)
- **analyzeCSV**: Orchestrates parsing and statistics calculation
- **main**: CLI entry point with argument validation and error handling

## Error Handling

- Missing CSV file: Returns "Error: File not found" with exit code 1
- No CSV path argument: Shows usage message with exit code 1
- Invalid data: Gracefully handles and skips problematic rows
