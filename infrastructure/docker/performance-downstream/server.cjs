const http = require('http');

const port = Number(process.env.PORT || 4180);
const maxLargeResponse = Number(process.env.MAX_LARGE_RESPONSE_BYTES || 1048576);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.min(Math.max(ms, 0), 30000)));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.split('/').filter(Boolean);
  if (url.pathname === '/health') return json(res, 200, { status: 'ok' });
  if (url.pathname === '/fast') return json(res, 200, { ok: true, mode: 'fast' });
  if (url.pathname === '/json') return json(res, 200, { ok: true, requestId: req.headers['x-request-id'] || null });
  if (path[0] === 'delay') {
    await delay(Number(path[1] || 0));
    return json(res, 200, { ok: true, delayedMs: Number(path[1] || 0) });
  }
  if (path[0] === 'status') return json(res, Number(path[1] || 500), { ok: false, status: Number(path[1] || 500) });
  if (path[0] === 'large-response') {
    const size = Math.min(Number(path[1] || 1024), maxLargeResponse);
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('x'.repeat(size));
  }
  if (url.pathname === '/malformed-json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{ malformed');
  }
  if (path[0] === 'redirect') {
    const count = Math.min(Number(path[1] || 1), 5);
    res.writeHead(302, { location: count <= 1 ? '/fast' : `/redirect/${count - 1}` });
    return res.end();
  }
  if (url.pathname === '/timeout') return;
  if (url.pathname === '/reset-connection') return req.socket.destroy();
  if (url.pathname === '/echo') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => json(res, 200, { method: req.method, bodyLength: Buffer.byteLength(body) }));
    return;
  }
  json(res, 404, { error: 'not_found' });
});

server.listen(port, () => {
  console.log(`Performance downstream stub listening on ${port}`);
});
