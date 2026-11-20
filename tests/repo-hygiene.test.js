// Chống lặp lại sự cố commit "Mới" (ad1dfff): file bị commit khi còn marker xung đột merge làm
// toàn bộ trang Bản đồ/Dẫn đường chết vì lỗi cú pháp JS.
// 1) Không file text nào trong repo được chứa marker <<<<<<< / >>>>>>>.
// 2) Mọi file JS phía trình duyệt phải parse được (node --check).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'tiles', 'node_modules', 'cache', '.claude']);
const TEXT_EXT = new Set(['.js', '.php', '.css', '.html', '.sql', '.json', '.md', '.txt', '.yml']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);

test('không còn marker xung đột merge trong mã nguồn', () => {
  const offenders = files
    .filter(f => TEXT_EXT.has(path.extname(f)))
    .filter(f => /^(<{7}|>{7})( |$)/m.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(ROOT, f));
  assert.deepEqual(offenders, []);
});

test('mọi file JS đều parse được (node --check)', () => {
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes(`${path.sep}tests${path.sep}`));
  const broken = [];
  for (const f of jsFiles) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (_) { broken.push(path.relative(ROOT, f)); }
  }
  assert.deepEqual(broken, []);
});
