// User journeys (vùng phủ riêng từng tòa/khu vực):
// 1) Hình tròn: điểm trong bán kính (= đường kính/2) -> true; ngoài -> false; đúng mép -> true.
// 2) Hình vuông (trục thẳng theo kinh/vĩ, kích thước theo đường chéo): điểm trong cạnh -> true;
//    điểm nằm trong vòng tròn ngoại tiếp nhưng ngoài cạnh vuông (góc) -> false.
// 3) Loại hình dạng không xác định hoặc coverage rỗng -> false, không throw.
// 4) Toạ độ không hợp lệ (NaN) -> false, không throw.
// 5) coverageRadiusM: trả đúng bán kính bao trọn hình, dùng để lọc sơ bộ ứng viên.

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPointInCoverage, coverageRadiusM, localOffsetM } = require('../js/lib/coverage.js');

const CENTER = { lat: 10.731936, lng: 106.699125 };

test('circle: tâm điểm -> true', () => {
  assert.equal(isPointInCoverage(CENTER.lat, CENTER.lng, CENTER.lat, CENTER.lng, { type: 'circle', diameterM: 50 }), true);
});

test('circle: điểm cách tâm 20m (trong bán kính 25m) -> true; cách 40m -> false', () => {
  const near = { lat: CENTER.lat + 20 / 111320, lng: CENTER.lng };
  const far = { lat: CENTER.lat + 40 / 111320, lng: CENTER.lng };
  const coverage = { type: 'circle', diameterM: 50 };
  assert.equal(isPointInCoverage(near.lat, near.lng, CENTER.lat, CENTER.lng, coverage), true);
  assert.equal(isPointInCoverage(far.lat, far.lng, CENTER.lat, CENTER.lng, coverage), false);
});

test('square: điểm trong cạnh (đường chéo 20m -> nửa cạnh ~7.07m) -> true', () => {
  const inside = { lat: CENTER.lat + 5 / 111320, lng: CENTER.lng };
  assert.equal(isPointInCoverage(inside.lat, inside.lng, CENTER.lat, CENTER.lng, { type: 'square', diagonalM: 20 }), true);
});

test('square: điểm trong vòng tròn ngoại tiếp nhưng ở góc (ngoài cạnh vuông) -> false', () => {
  // Đường chéo 20m -> nửa đường chéo 10m, nửa cạnh ~7.07m. Đặt điểm cách tâm 9m theo cả 2 trục
  // (nằm trong vòng tròn bán kính 10m nhưng vượt nửa cạnh 7.07m trên cả Bắc lẫn Đông) -> ngoài vuông.
  const corner = { lat: CENTER.lat + 9 / 111320, lng: CENTER.lng + 9 / (111320 * Math.cos(CENTER.lat * Math.PI / 180)) };
  assert.equal(isPointInCoverage(corner.lat, corner.lng, CENTER.lat, CENTER.lng, { type: 'square', diagonalM: 20 }), false);
});

test('polygon: điểm trong đường bao thật (hình chữ nhật xoay) -> true; ngoài -> false', () => {
  const ring = [[10.7320, 106.6990], [10.7322, 106.6992], [10.7318, 106.6996], [10.7316, 106.6994]];
  const coverage = { type: 'polygon', ring };
  assert.equal(isPointInCoverage(10.7319, 106.6993, CENTER.lat, CENTER.lng, coverage), true);
  assert.equal(isPointInCoverage(10.7330, 106.7000, CENTER.lat, CENTER.lng, coverage), false);
});

test('polygon: ring thiếu hoặc quá ít điểm -> false, không throw', () => {
  assert.equal(isPointInCoverage(10.7319, 106.6993, CENTER.lat, CENTER.lng, { type: 'polygon' }), false);
  assert.equal(isPointInCoverage(10.7319, 106.6993, CENTER.lat, CENTER.lng, { type: 'polygon', ring: [[10.73, 106.69]] }), false);
});

test('coverage rỗng hoặc type không xác định -> false, không throw', () => {
  assert.equal(isPointInCoverage(CENTER.lat, CENTER.lng, CENTER.lat, CENTER.lng, null), false);
  assert.equal(isPointInCoverage(CENTER.lat, CENTER.lng, CENTER.lat, CENTER.lng, { type: 'hinh-thang' }), false);
});

test('toạ độ NaN -> false, không throw', () => {
  assert.equal(isPointInCoverage(NaN, CENTER.lng, CENTER.lat, CENTER.lng, { type: 'circle', diameterM: 50 }), false);
  assert.equal(isPointInCoverage(CENTER.lat, CENTER.lng, NaN, CENTER.lng, { type: 'circle', diameterM: 50 }), false);
});

test('coverageRadiusM: tròn trả đúng bán kính, vuông trả nửa đường chéo, rỗng trả 0', () => {
  assert.equal(coverageRadiusM({ type: 'circle', diameterM: 50 }), 25);
  assert.equal(coverageRadiusM({ type: 'square', diagonalM: 20 }), 10);
  assert.equal(coverageRadiusM(null), 0);
});

test('localOffsetM: điểm dịch 10m về phía Bắc -> north xấp xỉ 10, east xấp xỉ 0', () => {
  const p = { lat: CENTER.lat + 10 / 111320, lng: CENTER.lng };
  const { north, east } = localOffsetM(CENTER.lat, CENTER.lng, p.lat, p.lng);
  assert.ok(Math.abs(north - 10) < 0.01);
  assert.ok(Math.abs(east) < 0.01);
});
