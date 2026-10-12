// User journeys (lối vào tòa nhà dùng để tìm đường, không hiện nhãn):
// 1) Tòa có lối vào -> trả về các lối của tòa đó.
// 2) Chọn tòa, có vị trí hiện tại -> trả lối vào gần nhất của tòa đó.
// 3) Tòa chưa có lối vào hoặc tên không tồn tại -> trả rỗng/null, không throw.

const test = require('node:test');
const assert = require('node:assert/strict');
const { entrancesFor, nearestEntrance } = require('../js/lib/entrances.js');

test('entrancesFor: Tòa K có 4 lối vào', () => {
  assert.equal(entrancesFor('toa-k').length, 4);
});

test('nearestEntrance: đứng gần lối 1 của Tòa K -> chọn toa-k-1', () => {
  const e = nearestEntrance('toa-k', 10.730981, 106.697624);
  assert.equal(e.id, 'toa-k-1');
});

test('nearestEntrance: tòa không có lối vào -> null, không throw', () => {
  assert.equal(nearestEntrance('toa-khong-co', 10.73, 106.69), null);
  assert.deepEqual(entrancesFor('toa-khong-co'), []);
});

test('entrancesFor: Tòa A có 4 lối vào (đo lại từ ảnh, thay cho 3 lối ước lượng trước đó)', () => {
  assert.equal(entrancesFor('toa-a').length, 4);
});

test('entrancesFor: Tòa C có 7 lối vào', () => {
  assert.equal(entrancesFor('toa-c').length, 7);
});

test('nearestEntrance: đứng gần lối 1 của Tòa G -> chọn toa-g-1', () => {
  const e = nearestEntrance('toa-g', 10.730917, 106.699208);
  assert.equal(e.id, 'toa-g-1');
});
