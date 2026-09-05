// Structured logging. Every line is JSON with a correlation id so a request
// can be traced end to end.
export function log(event, fields) {
  process.stdout.write(`${JSON.stringify({ level: 'info', event, ...fields })}\n`);
}

export function logError(event, error, fields) {
  process.stdout.write(`${JSON.stringify({
    level: 'error', event, message: error.message, stack: error.stack, ...fields,
  })}\n`);
}
