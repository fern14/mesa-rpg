import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');
const base = new URL(
  process.env.EXPO_PUBLIC_SITE_URL || 'https://fern14.github.io/mesa-rpg/',
).pathname.replace(/\/$/, '');
const root = path.resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
if (!existsSync(path.join(root, 'index.html')))
  throw new Error('Execute npm run build:web primeiro.');
createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === base) {
    res.writeHead(302, { Location: `${base}/` }).end();
    return;
  }
  if (!pathname.startsWith(`${base}/`)) {
    res.writeHead(404).end();
    return;
  }
  const relative = pathname.slice(base.length + 1) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isFile()) {
    res
      .writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
      .end(readFileSync(file));
  } else {
    res
      .writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(readFileSync(path.join(root, '404.html')));
  }
}).listen(4173, '127.0.0.1', () => console.log(`Prévia: http://127.0.0.1:4173${base}/`));
