const fs = require('fs');
const path = require('path');

const contractsIndex = path.join(process.cwd(), 'packages', 'contracts', 'src', 'index.ts');
const contractTestsDir = path.join(process.cwd(), 'tests', 'contract');

if (!fs.existsSync(contractsIndex)) {
  console.error('Missing packages/contracts/src/index.ts');
  process.exit(1);
}

if (!fs.existsSync(contractTestsDir)) {
  console.error('Missing tests/contract');
  process.exit(1);
}

console.log('Contract structure verified.');
