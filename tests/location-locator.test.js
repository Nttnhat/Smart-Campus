// User journeys (Giai đoạn 5 - navigation.html):
// 1) Vị trí GPS nằm trong bán kính 1 tòa nhà -> hiển thị "đang ở Tòa X" ở góc trên phải.
// 2) Vị trí GPS không gần tòa nào -> hiển thị "đang ở trên đường nội bộ <tên>" dựa theo road_node gần nhất.
// 3) Không xác định được gì (không có building/road nào) -> trả trạng thái "unknown", không throw.
// 4) Lộ trình đề xuất (danh sách road_node id theo thứ tự đường ngắn nhất) -> được format thành
//    các bước chỉ đường kiểu Google Maps dựa theo tên đoạn đường (road_edges.name).

const test = require('node:test');
const assert = require('node:assert/strict');
const { locateCurrentPosition, formatRouteSteps } = require('../js/lib/location-locator.js');

const BUILDINGS = [
  { place_id: 1, name: 'Tòa A', lat: 10.8010, lng: 106.7110 },
  { place_id: 2, name: 'Tòa B', lat: 10.8030, lng: 106.7130 },
];
const ROAD_NODES = [
  { id: 100, lat: 10.8050, lng: 106.7150 },
  { id: 101, lat: 10.8060, lng: 106.7160 },
];

test('locateCurrentPosition: GPS trong bán kính tòa nhà -> trả đúng tên tòa', () => {
  const point = { lat: 10.80101, lng: 106.71101 }; // rất gần Tòa A
  const result = locateCurrentPosition(point, { buildings: BUILDINGS, roadNodes: ROAD_NODES, buildingRadiusM: 40 });
  assert.equal(result.type, 'building');
  assert.equal(result.name, 'Tòa A');
});

test('locateCurrentPosition: GPS xa mọi tòa -> rơi về road_node gần nhất', () => {
  const point = { lat: 10.8051, lng: 106.7151 }; // gần node 100, xa các tòa
  const result = locateCurrentPosition(point, { buildings: BUILDINGS, roadNodes: ROAD_NODES, buildingRadiusM: 40 });
  assert.equal(result.type, 'road');
  assert.equal(result.nodeId, 100);
});

test('locateCurrentPosition: không có building/road nào -> trả type unknown, không throw', () => {
  const point = { lat: 0, lng: 0 };
  const result = locateCurrentPosition(point, { buildings: [], roadNodes: [] });
  assert.equal(result.type, 'unknown');
});

test('locateCurrentPosition: thiếu point -> trả unknown an toàn', () => {
  const result = locateCurrentPosition(null, { buildings: BUILDINGS, roadNodes: ROAD_NODES });
  assert.equal(result.type, 'unknown');
});

test('formatRouteSteps: tạo đúng số bước theo tên đoạn đường, gộp các đoạn liên tiếp cùng tên', () => {
  const nodeIds = [1, 2, 3, 4];
  const edgesByPair = {
    '1-2': { name: 'Đường nội bộ số 1', length_m: 50 },
    '2-3': { name: 'Đường nội bộ số 1', length_m: 30 }, // cùng tên -> gộp
    '3-4': { name: 'Lối đi bộ cạnh hồ', length_m: 20 },
  };
  const steps = formatRouteSteps(nodeIds, edgesByPair);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].roadName, 'Đường nội bộ số 1');
  assert.equal(steps[0].distanceM, 80); // 50+30 gộp
  assert.equal(steps[1].roadName, 'Lối đi bộ cạnh hồ');
  assert.equal(steps[1].distanceM, 20);
});

test('formatRouteSteps: lộ trình rỗng hoặc 1 node -> trả mảng rỗng, không throw', () => {
  assert.deepEqual(formatRouteSteps([], {}), []);
  assert.deepEqual(formatRouteSteps([1], {}), []);
});

test('formatRouteSteps: thiếu dữ liệu edge cho 1 đoạn -> dùng tên mặc định "Đường nội bộ", không throw', () => {
  const steps = formatRouteSteps([1, 2], {});
  assert.equal(steps.length, 1);
  assert.equal(steps[0].roadName, 'Đường nội bộ');
});
