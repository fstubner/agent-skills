const image = process.argv[process.argv.indexOf('--image') + 1];
const environment = process.argv[process.argv.indexOf('--environment') + 1];
if (!image || !environment) process.exit(2);
console.log(`promoted ${image} to ${environment}`);
