import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve('dist');
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let filePath = path.join(root, url.pathname);
    if (url.pathname.endsWith('/')) filePath = path.join(root, url.pathname, 'index.html');
    if (!path.extname(filePath)) filePath += '.html';
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const ct = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.css' ? 'text/css'
      : ext === '.js' ? 'text/javascript'
      : ext === '.svg' ? 'image/svg+xml'
      : 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.statusCode = 500;
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Serving dist on http://localhost:${port}`);
});


