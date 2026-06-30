const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const membersDir = path.join(distDir, 'members');
const eventsPath = path.resolve(__dirname, '..', 'src', 'data', 'events.ts');

if (!fs.existsSync(indexPath)) {
  throw new Error('dist/index.html was not found. Run the Vite build first.');
}

const rootIndex = fs.readFileSync(indexPath, 'utf8');
const nestedIndex = rootIndex.replaceAll('./assets/', '../assets/');
const deeplyNestedIndex = rootIndex.replaceAll('./assets/', '../../assets/');
const eventSource = fs.readFileSync(eventsPath, 'utf8');
const eventIds = Array.from(eventSource.matchAll(/id:\s*'([^']+)'/g), (match) => match[1]);

fs.mkdirSync(membersDir, { recursive: true });
fs.writeFileSync(path.join(membersDir, 'index.html'), nestedIndex);

for (const id of eventIds) {
  const eventDir = path.join(distDir, 'archive', id);
  fs.mkdirSync(eventDir, { recursive: true });
  fs.writeFileSync(path.join(eventDir, 'index.html'), deeplyNestedIndex);
}

fs.writeFileSync(path.join(distDir, '404.html'), rootIndex);
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
