// scripts/serve.js
// A static server for this folder, so the page can be looked at over HTTP.
//
// It exists because the page reads the files next to it with fetch, and a
// browser opened on file:// refuses that. It has no dependency, no cache and no
// writing: a request either finds a file or it does not.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const typeOf = (file) => TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

export function startServer({ port = 4173, host = '127.0.0.1', quiet = false } = {}) {
  const server = http.createServer(async (request, response) => {
    const requested = decodeURIComponent((request.url || '/').split('?')[0].split('#')[0]);
    const target = requested.endsWith('/') ? `${requested}index.html` : requested;
    const file = path.join(ROOT, path.normalize(target));

    const refuse = (status, reason) => {
      response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      response.end(`${status} ${reason}`);
      if (!quiet) console.log(`${status} ${requested} ${reason}`);
    };

    // Nothing outside this folder, and no dotfiles: .git is none of the page's
    // business.
    if (path.relative(ROOT, file).startsWith('..') || path.isAbsolute(path.relative(ROOT, file))) {
      return refuse(403, 'outside the folder');
    }
    if (target.split('/').some((part) => part.startsWith('.'))) return refuse(404, 'not found');

    try {
      const info = await stat(file);
      if (!info.isFile()) return refuse(404, 'not found');
      response.writeHead(200, {
        'content-type': typeOf(file),
        'content-length': info.size,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
      createReadStream(file).pipe(response);
      if (!quiet) console.log(`200 ${requested} ${info.size} bytes`);
    } catch {
      return refuse(404, 'not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        server,
        port: actual,
        url: `http://${host}:${actual}/`,
        close: () => new Promise((done) => server.close(() => done()))
      });
    });
  });
}

// Only start listening when this file is the one that was run, so the check
// script can import it and use a port of its own.
const runDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (runDirectly) {
  const port = Number(process.env.PORT || 4173);
  const started = await startServer({ port });
  const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  console.log(`Serving ${ROOT}`);
  console.log(`Open ${started.url}  (index.html is ${index.length} bytes)`);
  console.log('Ctrl+C to stop. Nothing is written by this server.');
  process.on('SIGINT', async () => {
    await started.close();
    process.exit(0);
  });
}
