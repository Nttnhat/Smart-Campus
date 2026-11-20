// User journeys (GPS sai số cao trên máy tính / điện thoại):
// 1) Mẫu đầu tiên sai 1 km (định vị qua Wi-Fi/IP) KHÔNG được hiện như vị trí thật; chờ mẫu tốt
//    trong thời gian khởi động, hết thời gian thì nhận mẫu tốt nhất nhưng báo "kém chính xác".
// 2) Bước nhảy vô lý (vượt tốc độ đi bộ + sai số) bị bỏ qua.
// 3) Nhiễu quanh 1 điểm đứng yên được làm mượt (Kalman) - lệch ít hơn mẫu thô.
// 4) Đi bộ thật thì vị trí lọc vẫn bám theo, không bị kẹt lại.
// 5) Thiết bị không có GPS (sai số > 100 m kéo dài) được nhận ra để gợi ý chọn điểm đầu thủ công.

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/lib/gps-filter.js');

const LAT0 = 10.7310, LNG0 = 106.6980;
const M = 1 / 111320; // 1 m theo vĩ độ
const s = (t, dLatM, dLngM, accuracy) => ({ lat: LAT0 + dLatM * M, lng: LNG0 + dLngM * M, accuracy, time: t * 1000 });

test('khởi động: bỏ mẫu sai 1 km, nhận mẫu tốt đầu tiên', () => {
  const f = G.createGpsFilter({ warmupAccuracy: 30, warmupMs: 10000 });
  const r1 = f.update(s(0, 1000, 0, 1200));
  assert.equal(r1.status, 'warming');
  assert.equal(r1.position, null);
  const r2 = f.update(s(2, 0, 0, 12));
  assert.equal(r2.status, 'ok');
  assert.ok(Math.abs(r2.position.lat - LAT0) < 2 * M);
});

test('khởi động hết thời gian: nhận mẫu tốt nhất nhưng gắn cờ kém chính xác', () => {
  const f = G.createGpsFilter({ warmupAccuracy: 30, warmupMs: 10000 });
  f.update(s(0, 500, 0, 900));
  f.update(s(4, 50, 0, 80));
  const r = f.update(s(11, 400, 0, 600));
  assert.equal(r.status, 'low-accuracy');
  assert.ok(Math.abs(r.position.lat - (LAT0 + 50 * M)) < 2 * M, 'phải lấy mẫu ±80 m chứ không phải mẫu cuối');
});

test('bỏ bước nhảy vô lý', () => {
  const f = G.createGpsFilter();
  f.update(s(0, 0, 0, 8));
  f.update(s(1, 1, 0, 8));
  const jump = f.update(s(2, 300, 0, 10));
  assert.equal(jump.rejected, true);
  assert.ok(Math.abs(jump.position.lat - LAT0) < 5 * M);
});

test('làm mượt nhiễu khi đứng yên', () => {
  const f = G.createGpsFilter();
  const noise = [6, -7, 5, -6, 7, -5, 6, -7, 5, -6];
  let last;
  noise.forEach((n, i) => { last = f.update(s(i, n, -n, 10)); });
  const errM = Math.hypot((last.position.lat - LAT0) / M, (last.position.lng - LNG0) / M);
  assert.ok(errM < 4, `lệch ${errM.toFixed(1)} m`);
});

test('đi bộ thật 1.4 m/s: vị trí lọc bám theo', () => {
  const f = G.createGpsFilter();
  let last;
  for (let t = 0; t <= 30; t++) last = f.update(s(t, t * 1.4, 0, 6));
  const lagM = (LAT0 + 30 * 1.4 * M - last.position.lat) / M;
  assert.ok(lagM < 6, `trễ ${lagM.toFixed(1)} m`);
});

test('nhận ra thiết bị không có GPS', () => {
  const f = G.createGpsFilter({ warmupMs: 5000 });
  let r;
  for (let t = 0; t < 8; t++) r = f.update(s(t * 2, 0, 0, 250));
  assert.equal(r.noGpsHardware, true);
});

test('mẫu không hợp lệ không crash', () => {
  const f = G.createGpsFilter();
  const r = f.update({ lat: NaN, lng: 1, accuracy: 5, time: 0 });
  assert.equal(r.position, null);
});

test('reset(): xoá trạng thái, quay lại như vừa khởi tạo', () => {
  const f = G.createGpsFilter({ warmupAccuracy: 30, warmupMs: 10000 });
  f.update(s(0, 0, 0, 12));
  assert.ok(f.current);
  f.reset();
  assert.equal(f.current, null);
  const r = f.update(s(0, 1000, 0, 1200));
  assert.equal(r.status, 'warming');
  assert.equal(r.position, null);
});
