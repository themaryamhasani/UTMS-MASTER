const { spawnSync } = require('node:child_process');

const action = process.argv[2] || 'up';
const compose = ['compose', '-f', 'infrastructure/compose/docker-compose.performance.yml'];

function run(args) {
  const result = spawnSync('docker', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (action === 'up') run([...compose, 'up', '-d', '--build']);
else if (action === 'down') run([...compose, 'down']);
else if (action === 'reset') run([...compose, 'down', '-v']);
else if (action === 'wait') {
  run([...compose, 'up', '-d', '--wait']);
} else {
  console.error(`Unknown performance stack action: ${action}`);
  process.exit(1);
}
