const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const host = process.env.HOST || '0.0.0.0';
const requestedPort = Number(process.env.PORT || 3000);
const maxPortAttempts = 10;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function createServer(port) {
  const server = http.createServer((req, res) => {
    let urlPath = req.url === '/' ? '/index.html' : req.url;
    const safePath = path.normalize(urlPath).replace(/^\/+/, '');
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      if (nextPort <= requestedPort + maxPortAttempts) {
        console.warn(`Port ${port} is already in use. Trying ${nextPort}...`);
        createServer(nextPort);
      } else {
        console.error(`Unable to start server. Ports ${requestedPort}-${requestedPort + maxPortAttempts} are busy.`);
        process.exit(1);
      }
    } else {
      console.error(err);
      process.exit(1);
    }
  });

  server.listen(port, host, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer(requestedPort);
