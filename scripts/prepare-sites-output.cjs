const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'server', 'sitesStaticWorker.mjs');
const serverDirectory = path.join(root, 'dist', 'server');
const destination = path.join(serverDirectory, 'index.js');

fs.mkdirSync(serverDirectory, { recursive: true });
fs.copyFileSync(source, destination);
