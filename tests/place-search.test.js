// User journeys (Giai đoạn 3 - sidebar campus-map):
// 1) Người dùng gõ tên địa điểm (không dấu hoặc có dấu) -> thấy đúng địa điểm khớp tên/alias.
// 2) Người dùng lọc theo danh mục (vd: "an-uong") -> chỉ thấy địa điểm thuộc danh mục đó.
// 3) Người dùng không nhập gì -> thấy toàn bộ danh sách, được nhóm theo danh mục để hiển thị sidebar.
// 4) Không có kết quả khớp -> trả về mảng rỗng, không throw.

const test = require('node:test');
const assert = require('node:assert/strict');
const { filterPlaces, groupByCategory } = require('../js/lib/place-search.js');

const PLACES = [
  { id: 1, name: 'Tòa A', aliases: 'toa a, building a', category_id: 1, category_code: 'toa-hoc' },
  { id: 2, name: 'Sảnh 711', aliases: '711, canteen', category_id: 2, category_code: 'an-uong' },
  { id: 3, name: 'Căn tin 10D', aliases: 'canteen 10d', category_id: 2, category_code: 'an-uong' },
  { id: 4, name: 'Hầm xe Tòa B', aliases: 'parking b', category_id: 3, category_code: 'ham-xe' },
];

test('filterPlaces: tìm theo tên không dấu khớp tên có dấu', () => {
  const result = filterPlaces(PLACES, { query: 'toa a' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test('filterPlaces: tìm theo alias', () => {
  const result = filterPlaces(PLACES, { query: 'canteen' });
  assert.deepEqual(result.map(p => p.id).sort(), [2, 3]);
});

test('filterPlaces: lọc theo category_id', () => {
  const result = filterPlaces(PLACES, { categoryId: 2 });
  assert.equal(result.length, 2);
  assert.ok(result.every(p => p.category_id === 2));
});

test('filterPlaces: kết hợp query + category', () => {
  const result = filterPlaces(PLACES, { query: '711', categoryId: 2 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
});

test('filterPlaces: query rỗng và không có category -> trả toàn bộ danh sách', () => {
  const result = filterPlaces(PLACES, {});
  assert.equal(result.length, PLACES.length);
});

test('filterPlaces: không khớp gì -> trả mảng rỗng, không throw', () => {
  const result = filterPlaces(PLACES, { query: 'khong-ton-tai-xyz' });
  assert.deepEqual(result, []);
});

test('filterPlaces: input places không phải mảng -> trả mảng rỗng an toàn', () => {
  assert.deepEqual(filterPlaces(null, { query: 'a' }), []);
  assert.deepEqual(filterPlaces(undefined, {}), []);
});

test('groupByCategory: nhóm đúng theo category_code', () => {
  const grouped = groupByCategory(PLACES);
  assert.equal(grouped['toa-hoc'].length, 1);
  assert.equal(grouped['an-uong'].length, 2);
  assert.equal(grouped['ham-xe'].length, 1);
});

test('groupByCategory: danh sách rỗng -> trả object rỗng', () => {
  assert.deepEqual(groupByCategory([]), {});
});
