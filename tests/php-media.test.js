// Kiểm tra phần PHP (chạy bằng PHP CLI; bỏ qua nếu máy không có php trên PATH hoặc PHP_BIN).
// 1) normalize_image_url() cho kết quả giống js/lib/drive-link.js (cùng quy tắc ở 2 phía).
// 2) sanitize_svg(): giữ hình vẽ + id các vùng phòng; xoá <script>, on*=, javascript:, <foreignObject>,
//    <use>/<image> trỏ ra ngoài, <style>; nội dung không phải SVG -> null.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PHP = process.env.PHP_BIN || 'php';
const ROOT = path.join(__dirname, '..');
const hasPhp = spawnSync(PHP, ['-v']).status === 0;
const skip = !hasPhp && 'không tìm thấy PHP CLI';

function php(code, input = '') {
  const res = spawnSync(PHP, ['-r', code], { cwd: ROOT, input, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

test('normalize_image_url khớp với bản JS', { skip }, () => {
  const D = require('../js/lib/drive-link.js');
  const cases = [
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_012345/view?usp=sharing',
    'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz_012345',
    'https://drive.google.com/drive/folders/1xyzFolderIdAbcdefghijkl',
    'https://example.com/a.jpg', 'http://example.com/a.jpg', 'javascript:alert(1)', '',
  ];
  const out = JSON.parse(php('require "includes/media.php"; $in = json_decode(stream_get_contents(STDIN), true); echo json_encode(array_map("normalize_image_url", $in));', JSON.stringify(cases)));
  cases.forEach((url, i) => {
    const js = D.toDisplayUrl(url);
    assert.equal(out[i].ok, js.ok, url);
    if (js.ok) assert.equal(out[i].url, js.url, url);
  });
});

const sanitize = svg => php('require "includes/svg-sanitizer.php"; $r = sanitize_svg(stream_get_contents(STDIN)); echo $r === null ? "NULL" : $r;', svg);

test('sanitize_svg giữ hình vẽ và id vùng phòng', { skip }, () => {
  const out = sanitize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><g id="tang-1"><rect id="A304" x="1" y="2" width="30" height="20" fill="#eee" stroke="#333"/><text x="5" y="15">A304</text></g></svg>');
  assert.match(out, /<rect[^>]*id="A304"/);
  assert.match(out, /viewBox="0 0 100 50"/);
  // Chỉ có viewBox -> tự thêm width/height để <img> có kích thước gốc (không bị co về 0).
  assert.match(out, /width="100"/);
  assert.match(out, /height="50"/);
  assert.match(out, />A304<\/text>/);
});

test('sanitize_svg xoá mọi thứ có thể chạy mã hoặc tải tài nguyên ngoài', { skip }, () => {
  const out = sanitize(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">
    <script>alert(2)</script><style>rect{background:url(https://evil.test/x)}</style>
    <a href="javascript:alert(3)"><rect id="r1" width="5" height="5" onclick="alert(4)"/></a>
    <foreignObject><iframe src="https://evil.test"></iframe></foreignObject>
    <use xlink:href="https://evil.test/s.svg#x"/><image href="https://evil.test/p.png"/>
  </svg>`);
  assert.doesNotMatch(out, /script|onload|onclick|javascript:|foreignObject|iframe|<style|evil\.test|<use|<image/i);
  assert.match(out, /<rect[^>]*id="r1"/);
});

test('nội dung không phải SVG -> null', { skip }, () => {
  assert.equal(sanitize('<html><body>hi</body></html>'), 'NULL');
  assert.equal(sanitize('không phải xml'), 'NULL');
  assert.equal(sanitize('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>').includes('root:'), false);
});
