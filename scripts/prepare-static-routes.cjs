const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const membersDir = path.join(distDir, 'members');

if (!fs.existsSync(indexPath)) {
  throw new Error('dist/index.html was not found. Run the Vite build first.');
}

const rootIndex = fs.readFileSync(indexPath, 'utf8');
const nestedIndex = rootIndex.replaceAll('./assets/', '../assets/');

fs.mkdirSync(membersDir, { recursive: true });
fs.writeFileSync(path.join(membersDir, 'index.html'), nestedIndex);
fs.writeFileSync(path.join(distDir, '404.html'), rootIndex);
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
