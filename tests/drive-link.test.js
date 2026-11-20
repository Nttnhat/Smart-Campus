// User journeys (admin dán link ảnh Google Drive cho địa điểm / sơ đồ tầng):
// 1) Dán link chia sẻ kiểu ".../file/d/<ID>/view?usp=sharing" -> đổi thành link hiển thị ảnh được.
// 2) Các dạng link Drive khác (open?id=, uc?id=, thumbnail?id=, lh3.googleusercontent.com/d/) đều nhận ra.
// 3) Dán link THƯ MỤC Drive -> báo lỗi rõ ràng (phải là link của 1 file).
// 4) Link ảnh https bình thường giữ nguyên; http://, javascript:, đường dẫn lạ -> từ chối.
// 5) Để trống -> hợp lệ (xoá ảnh).

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/lib/drive-link.js');

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_012345';
const DISPLAY = `https://drive.google.com/thumbnail?id=${ID}&sz=w1600`;

test('link chia sẻ Drive -> link hiển thị ảnh', () => {
  assert.deepEqual(D.toDisplayUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`), { ok: true, url: DISPLAY, driveId: ID });
});

test('nhận ra mọi dạng link Drive phổ biến', () => {
  for (const url of [
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?export=view&id=${ID}`,
    `https://drive.google.com/thumbnail?id=${ID}&sz=w400`,
    `https://lh3.googleusercontent.com/d/${ID}`,
    `https://docs.google.com/uc?id=${ID}`,
    `  https://drive.google.com/file/d/${ID}/view  `,
  ]) {
    assert.equal(D.toDisplayUrl(url).url, DISPLAY, url);
  }
});

test('link thư mục Drive bị từ chối với thông báo rõ', () => {
  const r = D.toDisplayUrl('https://drive.google.com/drive/folders/1xyzFolderIdAbcdefghijkl');
  assert.equal(r.ok, false);
  assert.match(r.error, /thư mục/);
});

test('link https thường giữ nguyên, link nguy hiểm/không https bị từ chối', () => {
  assert.deepEqual(D.toDisplayUrl('https://example.com/a.jpg'), { ok: true, url: 'https://example.com/a.jpg', driveId: null });
  for (const bad of ['http://example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAA', '/etc/passwd', 'abc']) {
    assert.equal(D.toDisplayUrl(bad).ok, false, bad);
  }
});

test('để trống là hợp lệ (xoá ảnh)', () => {
  assert.deepEqual(D.toDisplayUrl(''), { ok: true, url: '', driveId: null });
  assert.deepEqual(D.toDisplayUrl(null), { ok: true, url: '', driveId: null });
});
