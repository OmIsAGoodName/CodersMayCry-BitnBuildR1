#!/usr/bin/env node
/**
 * Standalone Zero-Dependency Static File Server for Vendora Submission
 * Serves the pre-compiled production bundle and automatically opens the browser.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5173;

// Find distribution directory
let distDir = path.resolve(process.cwd(), 'artifacts/orders-app/dist/public');
if (!fs.existsSync(distDir)) {
  distDir = path.resolve(process.cwd(), 'dist/public');
}
if (!fs.existsSync(distDir)) {
  distDir = path.resolve(process.cwd(), 'public');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(distDir, reqPath);

  // If path doesn't exist, serve SPA index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found - Please run pnpm run build first');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Server Error: ' + err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n======================================================');
  console.log('🚀 Vendora Sovereign Offline System is Running!');
  console.log(`📡 Local URL:   ${url}`);
  console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`);
  console.log('======================================================\n');
  console.log('Press Ctrl+C to stop the server.\n');

  // Auto-open browser
  const startCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
  exec(startCmd, () => {});
});
