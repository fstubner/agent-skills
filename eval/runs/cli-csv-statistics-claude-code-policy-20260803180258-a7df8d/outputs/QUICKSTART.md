# Quick Start

## Run the CLI

```bash
node src/cli.js sample.csv
```

Expected output:
```json
{"rowCount":3,"incidents":4,"response_minutes":15}
```

## Run Tests

```bash
npm test
```

Or manually:
```bash
node verify.js        # Unit tests (direct function calls)
node test/cli.test.js # Integration tests (file I/O)
```

## Try It Out

Create a test CSV:
```bash
cat > mydata.csv << 'EOF'
product,quantity,price
widget,100,25.50
gadget,50,15.99
doohickey,200,5.25
EOF
```

Run the CLI:
```bash
node src/cli.js mydata.csv
```

Expected:
```json
{"rowCount":3,"quantity":116.66666666666667,"price":15.58}
```

(quantity mean: (100+50+200)/3 ≈ 116.67, price mean: (25.50+15.99+5.25)/3 ≈ 15.58)

## API Usage

If you want to use it as a module:

```javascript
const fs = require('fs');

// Copy the functions from src/cli.js
function parseCSV(content) { /* ... */ }
function isNumeric(value) { /* ... */ }
function calculateMeans(headers, rows) { /* ... */ }

// Use it
const content = fs.readFileSync('data.csv', 'utf8');
const { headers, rows } = parseCSV(content);
const means = calculateMeans(headers, rows);

const result = {
  rowCount: rows.length,
  ...means
};

console.log(JSON.stringify(result));
```

## Examples

### CSV with all non-numeric column
```csv
name
alice
bob
charlie
```
Output: `{"rowCount":3}` (no means, no numeric columns)

### CSV with mixed values
```csv
id,status,score
1,active,90
2,inactive,
3,active,85
```
Output: `{"rowCount":3,"id":2,"score":87.5}` 
(status is text, id has numeric values, score mean is (90+85)/2=87.5)

### CSV with floats and negatives
```csv
temperature
-10.5
0.0
12.3
```
Output: `{"rowCount":3,"temperature":0.6}`
(mean: (-10.5+0.0+12.3)/3 = 0.6)
