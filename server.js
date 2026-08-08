const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
// 로컬 개발은 IPv4 loopback에만 바인딩한다. 다른 도구가 IPv6 localhost:3000을
// 쓰는 경우에도 브라우저의 localhost 요청이 프로젝트 서버로 올 수 있게 한다.
const host = process.env.HOST || '127.0.0.1';
const requestedPort = Number(process.env.PORT || 3000);
const maxPortAttempts = 10;
const apiOrigin = new URL(process.env.API_ORIGIN || 'https://aeg-hk.vercel.app');

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

function proxyApiRequest(req, res) {
  const targetPath = req.url || '/api';
  const requestHeaders = { ...req.headers, host: apiOrigin.host };
  delete requestHeaders.connection;

  const proxyRequest = https.request({
    protocol: apiOrigin.protocol,
    hostname: apiOrigin.hostname,
    port: apiOrigin.port || 443,
    method: req.method,
    path: targetPath,
    headers: requestHeaders
  }, proxyResponse => {
    const responseHeaders = { ...proxyResponse.headers };
    // 운영 서버의 세션 쿠키는 HTTPS 전용(Secure)이다. 로컬 HTTP 프록시에서는
    // 브라우저가 해당 쿠키를 보관하지 않으므로 개발 환경에 한해 Secure 속성만 제거한다.
    if (Array.isArray(responseHeaders['set-cookie'])) {
      responseHeaders['set-cookie'] = responseHeaders['set-cookie'].map(cookie =>
        cookie.replace(/;\s*Secure/ig, '').replace(/;\s*Domain=[^;]*/ig, '')
      );
    }
    res.writeHead(proxyResponse.statusCode || 502, responseHeaders);
    proxyResponse.pipe(res);
  });

  proxyRequest.on('error', error => {
    console.error(`API proxy error: ${error.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ error: '서버 API에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }));
  });

  req.pipe(proxyRequest);
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    if (req.url === '/api' || req.url?.startsWith('/api/')) {
      proxyApiRequest(req, res);
      return;
    }

    // 캐시 무효화용 ?v=... 같은 쿼리 문자열은 실제 파일 경로에서 제외한다.
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let urlPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
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
      // 로컬 개발 중에는 이전 인증 스크립트가 브라우저 캐시에 남지 않도록 한다.
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store, max-age=0' });
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
