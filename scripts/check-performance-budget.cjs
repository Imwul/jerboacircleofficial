const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'dist', 'assets');

const budgets = {
  totalAssets: 9_000_000,
  javascript: 360_000,
  css: 390_000,
  font: 1_900_000,
  image: 2_000_000,
};

function formatBytes(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fileKind(fileName) {
  if (/\.(js|mjs)$/.test(fileName)) return 'javascript';
  if (/\.css$/.test(fileName)) return 'css';
  if (/\.(woff2?|ttf|otf)$/.test(fileName)) return 'font';
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(fileName)) return 'image';
  return 'other';
}

assert(fs.existsSync(assetsDir), 'Missing dist/assets. Run the build first.');

const files = fs.readdirSync(assetsDir)
  .map((fileName) => {
    const filePath = path.join(assetsDir, fileName);
    return {
      fileName,
      kind: fileKind(fileName),
      size: fs.statSync(filePath).size,
    };
  })
  .filter((file) => file.kind !== 'other');

const totalAssets = files.reduce((sum, file) => sum + file.size, 0);
const failures = [];

if (totalAssets > budgets.totalAssets) {
  failures.push(`Total assets ${formatBytes(totalAssets)} exceed ${formatBytes(budgets.totalAssets)}.`);
}

for (const file of files) {
  const budget = budgets[file.kind];
  if (budget && file.size > budget) {
    failures.push(`${file.fileName} is ${formatBytes(file.size)}; ${file.kind} budget is ${formatBytes(budget)}.`);
  }
}

if (failures.length > 0) {
  console.error('Performance budget failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const largest = [...files]
  .sort((a, b) => b.size - a.size)
  .slice(0, 5)
  .map((file) => `${file.fileName} ${formatBytes(file.size)}`)
  .join(', ');

console.log(`Performance budget passed: ${formatBytes(totalAssets)} total assets. Largest: ${largest}`);
