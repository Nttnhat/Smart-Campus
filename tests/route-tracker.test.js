// User journeys (đang dẫn đường bằng GPS):
// 1) GPS dao động quanh tuyến (vài mét) -> KHÔNG tính lại tuyến (trước đây cứ đi 8 m là tính lại).
// 2) Thật sự đi lệch tuyến > ngưỡng trong nhiều mẫu liên tiếp -> tính lại đúng 1 lần.
// 3) Ngưỡng nới theo sai số GPS: GPS ±30 m thì cần lệch > 30 m mới coi là lệch.
// 4) Tiến độ: khoảng cách còn lại tính dọc theo tuyến, không theo đường chim bay.

const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/lib/route-tracker.js');

const LAT0 = 10.7310, LNG0 = 106.6980, D = 0.0001; // ~11 m
const route = [[LAT0, LNG0], [LAT0, LNG0 + 10 * D], [LAT0 + 10 * D, LNG0 + 10 * D]]; // Đông 110 m rồi Bắc 110 m

test('khoảng cách tới tuyến và vị trí chiếu lên tuyến', () => {
  const r = T.locateOnRoute([LAT0 + D, LNG0 + 5 * D], route);
  assert.ok(Math.abs(r.offRoute - 11) < 1, String(r.offRoute));
  assert.ok(Math.abs(r.alongRoute - 55) < 2, String(r.alongRoute));
  assert.ok(Math.abs(r.remaining - (220 - 55)) < 3, String(r.remaining));
});

test('GPS rung quanh tuyến không gây tính lại', () => {
  const gate = T.createRerouteGate({ threshold: 20, samples: 3 });
  const noisy = [3, -4, 6, -2, 5, -6, 4];
  const decisions = noisy.map((dLat, i) => gate.update([LAT0 + dLat * 1e-5, LNG0 + i * D], route, 8));
  assert.deepEqual(decisions, noisy.map(() => false));
});

test('lệch tuyến liên tục 3 mẫu -> tính lại đúng 1 lần rồi reset', () => {
  const gate = T.createRerouteGate({ threshold: 20, samples: 3 });
  const off = [LAT0 - 4 * D, LNG0 + 2 * D]; // lệch ~44 m về phía Nam
  assert.equal(gate.update(off, route, 5), false);
  assert.equal(gate.update(off, route, 5), false);
  assert.equal(gate.update(off, route, 5), true);
  assert.equal(gate.update(off, route, 5), false, 'sau khi kích hoạt phải chờ đủ mẫu mới');
});

test('ngưỡng nới theo sai số GPS', () => {
  const gate = T.createRerouteGate({ threshold: 20, samples: 2 });
  const off = [LAT0 - 3 * D, LNG0 + 2 * D]; // ~33 m
  assert.equal(gate.update(off, route, 40), false);
  assert.equal(gate.update(off, route, 40), false);
});

test('reset(): xoá đếm lệch tuyến đang tích luỹ', () => {
  const gate = T.createRerouteGate({ threshold: 20, samples: 3 });
  const off = [LAT0 - 4 * D, LNG0 + 2 * D]; // lệch ~44 m
  assert.equal(gate.update(off, route, 5), false);
  assert.equal(gate.update(off, route, 5), false);
  gate.reset();
  assert.equal(gate.update(off, route, 5), false, 'sau reset phải đếm lại từ đầu');
});

test('dữ liệu rỗng không crash', () => {
  assert.equal(T.locateOnRoute([LAT0, LNG0], []), null);
  const gate = T.createRerouteGate();
  assert.equal(gate.update([LAT0, LNG0], [], 5), false);
});

test('snapToRoute: lệch nhỏ hơn sai số GPS -> kéo về tuyến', () => {
  const near = [LAT0 + 2e-6, LNG0 + 5 * D]; // lệch ~0.2 m
  const snapped = T.snapToRoute(near, route, 8);
  assert.ok(snapped);
  assert.ok(Math.abs(snapped[0] - LAT0) < 1e-6);
});

test('snapToRoute: lệch quá xa -> null, không kéo về tuyến', () => {
  const far = [LAT0 + 20 * D, LNG0 + 5 * D]; // lệch ~220 m
  assert.equal(T.snapToRoute(far, route, 8), null);
});

test('snapToRoute: dữ liệu rỗng -> null', () => {
  assert.equal(T.snapToRoute([LAT0, LNG0], []), null);
});
