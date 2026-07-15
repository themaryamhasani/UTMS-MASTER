const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.API_CONSOLE_PORT = process.env.API_CONSOLE_PORT || '4174';
process.env.API_CONSOLE_CORS_ORIGIN = process.env.API_CONSOLE_CORS_ORIGIN || 'http://127.0.0.1:5173';
process.env.API_CONSOLE_DATA_DIR = process.env.API_CONSOLE_DATA_DIR || path.join('runtime', 'playwright-api-console');

const { createServer } = require('../../apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs');
const port = Number(process.env.API_CONSOLE_PORT);
createServer().listen(port, '0.0.0.0', () => {
  console.log(`UTMS isolated test API listening on ${port}`);
});
