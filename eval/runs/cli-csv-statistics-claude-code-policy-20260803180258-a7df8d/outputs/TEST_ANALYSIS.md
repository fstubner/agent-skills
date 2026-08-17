# Test Analysis and Expected Outputs

## Test Case 1: sample.csv (Provided)
```
team,incidents,response_minutes
alpha,3,12
beta,5,18
gamma,4,15
```

**Manual Calculation:**
- Row count: 3
- Column 'team': all non-numeric → no mean
- Column 'incidents': [3, 5, 4] → mean = (3+5+4)/3 = 12/3 = 4
- Column 'response_minutes': [12, 18, 15] → mean = (12+18+15)/3 = 45/3 = 15

**Expected Output:**
```json
{"rowCount":3,"incidents":4,"response_minutes":15}
```

**Code Path Analysis:**
1. `parseCSV()` splits on '\n', trims whitespace
2. Headers: ['team', 'incidents', 'response_minutes']
3. Rows: [{team: 'alpha', incidents: '3', response_minutes: '12'}, ...]
4. `calculateMeans()` checks each column:
   - 'team': isNumeric('alpha') = false, skip
   - 'incidents': isNumeric('3') = true, collect [3,5,4], mean = 4
   - 'response_minutes': isNumeric('12') = true, collect [12,18,15], mean = 15
5. Result: {rowCount: 3, incidents: 4, response_minutes: 15}

---

## Test Case 2: Mixed Type Columns
```
name,score,grade
alice,90,A
bob,85,B
charlie,95,A
```

**Manual Calculation:**
- Row count: 3
- Column 'name': all text → skip
- Column 'score': [90, 85, 95] → mean = (90+85+95)/3 = 270/3 = 90
- Column 'grade': all text → skip

**Expected Output:**
```json
{"rowCount":3,"score":90}
```

---

## Test Case 3: Sparse Data with Missing Values
```
id,value,status
1,100,active
2,,inactive
3,50,active
```

**Manual Calculation:**
- Row count: 3
- Column 'id': [1, 2, 3] → mean = (1+2+3)/3 = 2
- Column 'value': ["100", "", "50"] → numeric: [100, 50] → mean = (100+50)/2 = 75
  (Note: empty string is skipped, only 2 numeric values)
- Column 'status': all text → skip

**Expected Output:**
```json
{"rowCount":3,"id":2,"value":75}
```

---

## Test Case 4: Floats and Negative Numbers
```
temperature,altitude
-15.5,1200
2.3,1800
8.7,1500
```

**Manual Calculation:**
- Row count: 3
- Column 'temperature': [-15.5, 2.3, 8.7] → mean = (-15.5+2.3+8.7)/3 = -4.5/3 = -1.5
- Column 'altitude': [1200, 1800, 1500] → mean = (1200+1800+1500)/3 = 4500/3 = 1500

**Expected Output:**
```json
{"rowCount":3,"temperature":-1.5,"altitude":1500}
```

---

## Test Case 5: Only Headers (No Data)
```
col1,col2,col3
```

**Manual Calculation:**
- Row count: 0 (no data rows)
- No numeric calculations possible

**Expected Output:**
```json
{"rowCount":0}
```

---

## Test Case 6: Single Row
```
metric
42
```

**Manual Calculation:**
- Row count: 1
- Column 'metric': [42] → mean = 42/1 = 42

**Expected Output:**
```json
{"rowCount":1,"metric":42}
```

---

## Code Coverage

### Error Handling
1. **Missing CSV file**: Caught by try/catch in main(), error message to stderr, exit(1)
2. **No arguments**: Checked before file read, usage message to stderr, exit(1)
3. **Empty file**: parseCSV returns {headers: [], rows: []}
4. **Malformed CSV**: Lines with fewer columns than headers get empty strings for missing values

### Numeric Detection Logic
- `isNumeric()` correctly returns false for: "", null, undefined, "abc", "3.14.15"
- `isNumeric()` correctly returns true for: "0", "42", "-5", "3.14", "1e5"
- `Number()` and `isNaN()` properly handle these cases

### Mean Calculation Logic
- When all values in a column are non-numeric: column omitted from output
- When some values are numeric: mean calculated from only numeric values
- When column has no data: handled by empty filter result
- Division by numericValues.length prevents division by zero (checked by if condition)

---

## Design Validation

✓ **No external dependencies**: Uses only Node.js built-in modules (fs, path)
✓ **CLI interface**: Takes CSV path as command-line argument, outputs JSON to stdout
✓ **Proper error codes**: Exit(1) on error, exit(0) on success
✓ **Handles edge cases**: Empty files, sparse data, mixed types, negative/float numbers
✓ **Deterministic output**: Same input always produces same output
✓ **JSON format**: Output is valid JSON that can be parsed by `JSON.parse()`
