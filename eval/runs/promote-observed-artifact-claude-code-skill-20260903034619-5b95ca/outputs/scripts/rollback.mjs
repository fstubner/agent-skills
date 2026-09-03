const environment = process.argv[process.argv.indexOf('--environment') + 1];
if (!environment) process.exit(2);
console.log(`rolled back ${environment} to previous version`);
