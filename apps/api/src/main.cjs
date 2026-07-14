const { createServer } = require('./modules/api-console/infrastructure/http/api-console-server.cjs');

const port = Number(process.env.API_CONSOLE_PORT || 4174);

createServer().listen(port, () => {
  console.log(`UTMS API listening on http://localhost:${port}`);
});
