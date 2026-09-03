console.log(`registry.example/app:${process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'latest'}`);
