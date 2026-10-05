// User journeys (Giai đoạn 4 - building-details):
// 1) Tòa học (có floors): sidebar hiển thị tên, mô tả, số tầng, số phòng, danh sách tầng.
// 2) Click vào 1 tầng -> lấy đúng sơ đồ (floor_plan_svg) của tầng đó để hiển thị bên phải.
// 3) Khu vực không phân tầng (vd: sân thể thao) -> vẫn trả về summary hợp lệ với floorCount = 0,
//    không có danh sách tầng, không throw.
// 4) Yêu cầu tầng không tồn tại -> trả null (không throw), để UI tự xử lý "không tìm thấy".

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFloorSummary, getFloorByLevel } = require('../js/lib/floor-plan.js');

const BUILDING = { place_id: 1, name: 'Tòa A', description: 'Tòa học chính', code: 'A' };
const FLOORS = [
  { id: 10, building_id: 1, level: 0, name: 'Tầng trệt (G)', floor_plan_svg: '<svg>G</svg>', room_count: 5 },
  { id: 11, building_id: 1, level: 1, name: 'Tầng 1', floor_plan_svg: '<svg>1</svg>', room_count: 8 },
  { id: 12, building_id: 1, level: 2, name: 'Tầng 2', floor_plan_svg: '<svg>2</svg>', room_count: 6 },
];

test('buildFloorSummary: tòa có tầng -> đúng số tầng và tổng số phòng', () => {
  const summary = buildFloorSummary(BUILDING, FLOORS);
  assert.equal(summary.hasFloors, true);
  assert.equal(summary.floorCount, 3);
  assert.equal(summary.roomCount, 19); // 5+8+6
  assert.equal(summary.name, 'Tòa A');
});

test('buildFloorSummary: khu không phân tầng -> hasFloors=false, floorCount=0, không throw', () => {
  const summary = buildFloorSummary({ place_id: 2, name: 'Sân bóng rổ', description: '' }, []);
  assert.equal(summary.hasFloors, false);
  assert.equal(summary.floorCount, 0);
  assert.equal(summary.roomCount, 0);
});

test('buildFloorSummary: floors không phải mảng -> xử lý an toàn như rỗng', () => {
  const summary = buildFloorSummary(BUILDING, null);
  assert.equal(summary.hasFloors, false);
  assert.equal(summary.floorCount, 0);
});

test('getFloorByLevel: lấy đúng tầng theo level để hiển thị sơ đồ', () => {
  const floor = getFloorByLevel(FLOORS, 1);
  assert.equal(floor.id, 11);
  assert.equal(floor.floor_plan_svg, '<svg>1</svg>');
});

test('getFloorByLevel: level không tồn tại -> trả null, không throw', () => {
  assert.equal(getFloorByLevel(FLOORS, 99), null);
});

test('getFloorByLevel: input floors không phải mảng -> trả null', () => {
  assert.equal(getFloorByLevel(undefined, 0), null);
});
