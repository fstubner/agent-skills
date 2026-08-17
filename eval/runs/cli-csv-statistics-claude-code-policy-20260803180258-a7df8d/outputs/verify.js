const fs = require('fs');

// Inline CLI logic for testing
function parseCSV(content) {
  const lines = content.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, header, idx) => {
      obj[header] = values[idx] || '';
      return obj;
    }, {});
  });
  return { headers, rows };
}

function isNumeric(value) {
  if (value === '' || value === null || value === undefined) {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && value !== '';
}

function calculateMeans(headers, rows) {
  if (rows.length === 0) {
    return {};
  }
  const means = {};
  headers.forEach(header => {
    const values = rows.map(row => row[header]);
    const numericValues = values.filter(isNumeric).map(Number);
    if (numericValues.length > 0) {
      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      means[header] = sum / numericValues.length;
    }
  });
  return means;
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  ${err.message}`);
    process.exit(1);
  }
}

console.log('Testing CSV parsing and mean calculation...\n');

test('Sample CSV with 3 rows', () => {
  const csv = 'team,incidents,response_minutes\nalpha,3,12\nbeta,5,18\ngamma,4,15';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if (rows.length !== 3) throw new Error(`Expected 3 rows, got ${rows.length}`);
  if (means.incidents !== 4) throw new Error(`Expected incidents mean 4, got ${means.incidents}`);
  if (means.response_minutes !== 15) throw new Error(`Expected response_minutes mean 15, got ${means.response_minutes}`);
  if ('team' in means) throw new Error('team should not have a mean');
});

test('Single numeric column', () => {
  const csv = 'value\n10\n20\n30';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if (rows.length !== 3) throw new Error(`Expected 3 rows, got ${rows.length}`);
  if (means.value !== 20) throw new Error(`Expected mean 20, got ${means.value}`);
});

test('Mixed numeric and text', () => {
  const csv = 'name,score\nalice,90\nbob,85\ncharlie,95';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if (means.score !== 90) throw new Error(`Expected score mean 90, got ${means.score}`);
  if ('name' in means) throw new Error('name should not have a mean');
});

test('Sparse data with missing values', () => {
  const csv = 'name,value\nalice,10\nbob,\ncharlie,20';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if (rows.length !== 3) throw new Error(`Expected 3 rows, got ${rows.length}`);
  if (means.value !== 15) throw new Error(`Expected mean 15 (ignoring empty), got ${means.value}`);
});

test('Only headers, no data', () => {
  const csv = 'col1,col2,col3';
  const { headers, rows } = parseCSV(csv);

  if (rows.length !== 0) throw new Error(`Expected 0 rows, got ${rows.length}`);
});

test('Floats and negative numbers', () => {
  const csv = 'metric\n1.5\n-2.5\n3.0';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  const expected = (1.5 - 2.5 + 3.0) / 3;
  if (Math.abs(means.metric - expected) > 0.0001) {
    throw new Error(`Expected mean ${expected}, got ${means.metric}`);
  }
});

test('All non-numeric column', () => {
  const csv = 'status\nactive\ninactive\npending';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if ('status' in means) throw new Error('status should not have a mean');
});

test('Multiple numeric columns', () => {
  const csv = 'x,y,z\n1,2,3\n4,5,6\n7,8,9';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if (means.x !== 4) throw new Error(`Expected x mean 4, got ${means.x}`);
  if (means.y !== 5) throw new Error(`Expected y mean 5, got ${means.y}`);
  if (means.z !== 6) throw new Error(`Expected z mean 6, got ${means.z}`);
});

test('Whitespace handling', () => {
  const csv = 'a, b , c\n 1 , 2 , 3 \n4,5,6';
  const { headers, rows } = parseCSV(csv);
  const means = calculateMeans(headers, rows);

  if (means.a !== 2.5) throw new Error(`Expected a mean 2.5, got ${means.a}`);
  if (means.b !== 3.5) throw new Error(`Expected b mean 3.5, got ${means.b}`);
  if (means.c !== 4.5) throw new Error(`Expected c mean 4.5, got ${means.c}`);
});

test('Sample file exists and is valid', () => {
  const content = fs.readFileSync('sample.csv', 'utf8');
  const { headers, rows } = parseCSV(content);
  const means = calculateMeans(headers, rows);

  if (rows.length !== 3) throw new Error(`Expected 3 rows in sample.csv, got ${rows.length}`);
  if (means.incidents !== 4) throw new Error(`Expected incidents mean 4 in sample, got ${means.incidents}`);
  if (means.response_minutes !== 15) throw new Error(`Expected response_minutes mean 15 in sample, got ${means.response_minutes}`);
});

console.log('\nAll tests passed!');
