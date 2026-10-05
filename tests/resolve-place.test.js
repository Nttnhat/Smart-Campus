// User journeys (chọn điểm trên bản đồ):
// 1) Bấm gần tâm một tòa/khu đã có nhãn -> trả đúng địa điểm đó (vd: bấm Tòa A -> "Tòa A").
// 2) Bấm cách nhãn quá xa (> bán kính) -> trả null, để bản đồ dùng cách chọn thông thường.
// 3) Nhiều nhãn trong bán kính -> trả nhãn gần nhất.
// 4) Dữ liệu không hợp lệ (điểm NaN, danh sách rỗng) -> trả null, không throw.

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePlaceAtPoint } = require('../js/lib/resolve-place.js');

const PLACES = [
  { id: 'toa-a', name: 'Tòa A', lat: 10.731936, lng: 106.699125 },
  { id: 'ham-xe-cong-cong', name: 'Hầm xe phương tiện công cộng', lat: 10.731883, lng: 106.698626 },
];

test('resolvePlaceAtPoint: bấm đúng tâm Tòa A -> trả Tòa A', () => {
  const result = resolvePlaceAtPoint(10.731936, 106.699125, PLACES, 30);
  assert.equal(result.id, 'toa-a');
});

test('resolvePlaceAtPoint: bấm gần hầm xe công cộng trong bán kính -> trả đúng hầm xe', () => {
  const result = resolvePlaceAtPoint(10.731890, 106.698630, PLACES, 30);
  assert.equal(result.id, 'ham-xe-cong-cong');
});

test('resolvePlaceAtPoint: bấm xa mọi nhãn (ngoài bán kính) -> null', () => {
  assert.equal(resolvePlaceAtPoint(10.7400, 106.7000, PLACES, 30), null);
});

test('resolvePlaceAtPoint: nhiều nhãn trong bán kính -> trả nhãn gần nhất', () => {
  const places = [
    { id: 'a', name: 'A', lat: 10.73190, lng: 106.69900 },
    { id: 'b', name: 'B', lat: 10.73192, lng: 106.69900 },
  ];
  assert.equal(resolvePlaceAtPoint(10.73191, 106.69900, places, 100).id, 'a');
});

test('resolvePlaceAtPoint: điểm NaN hoặc danh sách rỗng -> null, không throw', () => {
  assert.equal(resolvePlaceAtPoint(NaN, 106.7, PLACES, 30), null);
  assert.equal(resolvePlaceAtPoint(10.7, 106.7, [], 30), null);
  assert.equal(resolvePlaceAtPoint(10.7, 106.7, null, 30), null);
});

test('resolvePlaceAtPoint: bấm trong khu cây xanh, xa mọi nhãn -> trả khu cây xanh', () => {
  const areas = [{ name: 'Khu cây xanh', category: 'Cây xanh', rings: [[10.7300, 106.6980], [10.7300, 106.6990], [10.7310, 106.6990], [10.7310, 106.6980]] }];
  const result = resolvePlaceAtPoint(10.7305, 106.6985, PLACES, 12, areas);
  assert.equal(result.name, 'Khu cây xanh');
});

test('resolvePlaceAtPoint: có nhãn sát điểm bấm -> ưu tiên nhãn hơn khu cây xanh', () => {
  const areas = [{ name: 'Khu cây xanh', category: 'Cây xanh', rings: [[10.7300, 106.6980], [10.7300, 106.6990], [10.7310, 106.6990], [10.7310, 106.6980]] }];
  const result = resolvePlaceAtPoint(10.731936, 106.699125, PLACES, 12, areas);
  assert.equal(result.id, 'toa-a');
});
