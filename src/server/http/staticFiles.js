const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm'
};

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin/index.html';
  if (pathname === '/student') pathname = '/student/index.html';

  const absolutePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(absolutePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Ikke funnet');
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME_TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=120'
    });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

function serveUpload(req, res, url) {
  const filename = path.basename(decodeURIComponent(url.pathname.replace('/uploads/', '')));
  const absolutePath = path.normalize(path.join(UPLOAD_DIR, filename));
  if (!absolutePath.startsWith(UPLOAD_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(absolutePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Ikke funnet');
      return;
    }
    const ext = path.extname(absolutePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME_TYPES[ext] || 'application/octet-stream',
      'cache-control': 'private, max-age=300'
    });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

module.exports = { serveStatic, serveUpload };
