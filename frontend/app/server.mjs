import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url));
const BASE_PATH = '/car_bbox_detector';
const PORT = Number(process.env.PORT || 8080);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const stripped = urlPath.startsWith(BASE_PATH)
    ? urlPath.slice(BASE_PATH.length)
    : urlPath;
  const decoded = decodeURIComponent(stripped.split('?')[0] || '/');
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = join(ROOT, normalized || 'index.html');
  return candidate.startsWith(ROOT) ? candidate : null;
}

function sendFile(path, response) {
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  createReadStream(path).pipe(response);
}

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/') {
    response.writeHead(302, { Location: `${BASE_PATH}/` });
    response.end();
    return;
  }

  if (!url.pathname.startsWith(`${BASE_PATH}/`) && url.pathname !== BASE_PATH) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const candidate = safePath(url.pathname);
  if (candidate && existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(candidate, response);
    return;
  }

  sendFile(join(ROOT, 'index.html'), response);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${ROOT} at http://0.0.0.0:${PORT}${BASE_PATH}/`);
});
