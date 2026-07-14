const { spawn } = require('child_process');

const commands = [
  ['npm', ['run', 'dev:web']],
  ['npm', ['run', 'dev:api']],
  ['npm', ['run', 'dev:worker']],
  ['npm', ['run', 'dev:runner']],
];

const children = commands.map(([command, args]) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('exit', code => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
});

process.on('SIGINT', () => {
  for (const child of children) child.kill('SIGINT');
});
