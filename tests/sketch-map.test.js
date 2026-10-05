// User journeys (bản đồ dạng sketch, không nhãn chữ, chỉ trong khuôn viên TDTU):
// 1) Đối tượng OSM có tag building -> phân loại 'building', để vẽ outline tòa nhà kiểu sketch.
// 2) Đối tượng có tag natural=water hoặc waterway -> phân loại 'water'.
// 3) Đối tượng highway=footway/path/pedestrian/steps -> phân loại 'pedestrian' (lối đi bộ).
// 4) Đối tượng highway=service/residential/unclassified/tertiary -> phân loại 'road'.
// 5) Đối tượng không thuộc nhóm trên (vd: tourism, shop lẻ ngoài campus) -> phân loại 'ignore', không vẽ.
// 6) Mỗi phân loại có 1 style sketch riêng (màu/độ dày nét), không có text/label nào trong style.
// 7) Điểm nằm trong bounds khuôn viên TDTU -> true; nằm ngoài (vd: Mapletree Business Centre xa trường) -> false,
//    dùng để cắt bỏ các đối tượng lạc ra ngoài campus trước khi vẽ.

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyMapFeature, sketchStyleFor, isWithinCampus } = require('../js/lib/sketch-map.js');

test('classifyMapFeature: building -> "building"', () => {
  assert.equal(classifyMapFeature({ building: 'yes' }), 'building');
  assert.equal(classifyMapFeature({ building: 'university' }), 'building');
});

test('classifyMapFeature: natural=water hoặc waterway -> "water"', () => {
  assert.equal(classifyMapFeature({ natural: 'water' }), 'water');
  assert.equal(classifyMapFeature({ waterway: 'stream' }), 'water');
});

test('classifyMapFeature: highway đi bộ -> "pedestrian"', () => {
  assert.equal(classifyMapFeature({ highway: 'footway' }), 'pedestrian');
  assert.equal(classifyMapFeature({ highway: 'path' }), 'pedestrian');
  assert.equal(classifyMapFeature({ highway: 'pedestrian' }), 'pedestrian');
  assert.equal(classifyMapFeature({ highway: 'steps' }), 'pedestrian');
});

test('classifyMapFeature: highway xe/đường nội bộ -> "road"', () => {
  assert.equal(classifyMapFeature({ highway: 'service' }), 'road');
  assert.equal(classifyMapFeature({ highway: 'residential' }), 'road');
  assert.equal(classifyMapFeature({ highway: 'unclassified' }), 'road');
  assert.equal(classifyMapFeature({ highway: 'tertiary' }), 'road');
});

test('classifyMapFeature: tag không liên quan -> "ignore"', () => {
  assert.equal(classifyMapFeature({ tourism: 'hotel' }), 'ignore');
  assert.equal(classifyMapFeature({}), 'ignore');
  assert.equal(classifyMapFeature(null), 'ignore');
});

test('sketchStyleFor: mỗi loại có style riêng, không chứa text/label', () => {
  const building = sketchStyleFor('building');
  const water = sketchStyleFor('water');
  const pedestrian = sketchStyleFor('pedestrian');
  const road = sketchStyleFor('road');
  assert.ok(building.color && building.fillColor);
  assert.ok(water.color && water.fillColor);
  assert.ok(pedestrian.color);
  assert.ok(road.color);
  for (const style of [building, water, pedestrian, road]) {
    assert.equal(style.label, undefined);
    assert.equal(style.tooltip, undefined);
  }
});

test('sketchStyleFor: loại không xác định ("ignore"/khác) -> trả null, không vẽ', () => {
  assert.equal(sketchStyleFor('ignore'), null);
  assert.equal(sketchStyleFor('khong-ton-tai'), null);
});

test('isWithinCampus: điểm trong bounds TDTU -> true', () => {
  const bounds = { south: 10.7288, west: 106.694, north: 10.7365, east: 106.704 };
  assert.equal(isWithinCampus(10.732, 106.699, bounds), true);
});

test('isWithinCampus: điểm xa khuôn viên (vd: Mapletree Business Centre) -> false', () => {
  const bounds = { south: 10.7288, west: 106.694, north: 10.7365, east: 106.704 };
  assert.equal(isWithinCampus(10.7298, 106.7023, bounds), false);
});

test('isWithinCampus: toạ độ không hợp lệ -> false, không throw', () => {
  const bounds = { south: 10.7288, west: 106.694, north: 10.7365, east: 106.704 };
  assert.equal(isWithinCampus(NaN, 106.699, bounds), false);
  assert.equal(isWithinCampus(10.732, undefined, bounds), false);
});
