// Test tích hợp API chia sẻ vị trí (UC-12). Cần PHP + MySQL đang chạy, giống api.integration.test.js.
//   php -S 127.0.0.1:8099 -t .
//   SC_API_BASE=http://127.0.0.1:8099 node --test tests/location-share.test.js
// User journeys:
// 1) A mời B bằng MSSV -> B thấy lời mời -> B chấp nhận -> cả 2 update vị trí -> đọc thấy vị trí nhau.
// 2) B dừng chia sẻ -> A không còn đọc được vị trí B nữa.
// 3) Mời chính mình / MSSV không tồn tại -> lỗi rõ ràng. Mời trùng -> 409.
// 4) Người thứ 3 không liên quan không update/accept được phiên của người khác.

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.SC_API_BASE;
const skip = !BASE && 'đặt SC_API_BASE để chạy test tích hợp';

function client() {
  let cookie = '';
  let csrf = '';
  async function request(path, { method = 'GET', data, withCsrf = true } = {}) {
    const h = { Accept: 'application/json' };
    if (cookie) h.Cookie = cookie;
    if (method !== 'GET' && withCsrf) h['X-CSRF-Token'] = csrf;
    if (data) h['Content-Type'] = 'application/json';
    const res = await fetch(BASE + '/' + path, { method, headers: h, body: data ? JSON.stringify(data) : undefined, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(',').map(c => c.split(';')[0].trim()).filter(c => c.startsWith('PHPSESSID')).pop() || cookie;
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (_) { /* HTML */ }
    return { status: res.status, body };
  }
  async function init() {
    const page = await request('home.php');
    const m = /name="csrf-token" content="([a-f0-9]+)"/.exec(page.body);
    assert.ok(m, 'home.php phải in meta csrf-token');
    csrf = m[1];
  }
  async function registerAndLogin(code) {
    await request('api/user/register.php', { method: 'POST', data: { student_code: code, full_name: 'SV ' + code, password: 'matkhau123' } });
  }
  return { request, init, registerAndLogin };
}

test('mời -> chấp nhận -> cả 2 update vị trí -> đọc thấy vị trí nhau -> dừng', { skip }, async () => {
  const codeA = 'SA' + Date.now().toString().slice(-8);
  const codeB = 'SB' + Date.now().toString().slice(-8);
  const a = client(); await a.init(); await a.registerAndLogin(codeA);
  const b = client(); await b.init(); await b.registerAndLogin(codeB);

  const selfInvite = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: codeA } });
  assert.equal(selfInvite.status, 400);

  const noUser = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: 'KHONG-TON-TAI-123' } });
  assert.equal(noUser.status, 404);

  const invite = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: codeB } });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const shareId = invite.body.id;

  const dup = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: codeB } });
  assert.equal(dup.status, 409);

  const bList = await b.request('api/user/location-share.php');
  const pending = bList.body.results.find(s => s.id === shareId);
  assert.ok(pending, 'B phải thấy lời mời đang chờ');
  assert.equal(pending.status, 'pending');
  assert.equal(pending.direction, 'incoming');

  const aAccept = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'accept', id: shareId } });
  assert.equal(aAccept.status, 403, 'A (requester) không được tự chấp nhận lời mời của mình');

  const accept = await b.request('api/user/location-share.php', { method: 'POST', data: { action: 'accept', id: shareId } });
  assert.equal(accept.status, 200, JSON.stringify(accept.body));

  const upA = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'update', id: shareId, lat: 10.7315, lng: 106.6985 } });
  assert.equal(upA.status, 200, JSON.stringify(upA.body));
  const upB = await b.request('api/user/location-share.php', { method: 'POST', data: { action: 'update', id: shareId, lat: 10.732, lng: 106.699 } });
  assert.equal(upB.status, 200, JSON.stringify(upB.body));

  const outside = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'update', id: shareId, lat: 21.03, lng: 105.85 } });
  assert.equal(outside.status, 400, 'toạ độ ngoài campus phải bị từ chối');

  const aView = (await a.request('api/user/location-share.php')).body.results.find(s => s.id === shareId);
  assert.equal(aView.otherPosition.lat, 10.732);
  const bView = (await b.request('api/user/location-share.php')).body.results.find(s => s.id === shareId);
  assert.equal(bView.otherPosition.lat, 10.7315);

  const stop = await b.request('api/user/location-share.php', { method: 'POST', data: { action: 'stop', id: shareId } });
  assert.equal(stop.status, 200);
  const afterStop = (await a.request('api/user/location-share.php')).body.results.find(s => s.id === shareId);
  assert.equal(afterStop, undefined, 'phiên đã stopped thì không còn xuất hiện trong danh sách');

  const updateAfterStop = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'update', id: shareId, lat: 10.73, lng: 106.69 } });
  assert.equal(updateAfterStop.status, 400);
});

test('người không liên quan không thao tác được trên phiên của người khác', { skip }, async () => {
  const codeA = 'XA' + Date.now().toString().slice(-8);
  const codeB = 'XB' + Date.now().toString().slice(-8);
  const codeC = 'XC' + Date.now().toString().slice(-8);
  const a = client(); await a.init(); await a.registerAndLogin(codeA);
  const b = client(); await b.init(); await b.registerAndLogin(codeB);
  const c = client(); await c.init(); await c.registerAndLogin(codeC);

  const invite = await a.request('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: codeB } });
  const shareId = invite.body.id;

  assert.equal((await c.request('api/user/location-share.php', { method: 'POST', data: { action: 'accept', id: shareId } })).status, 403);
  assert.equal((await c.request('api/user/location-share.php', { method: 'POST', data: { action: 'stop', id: shareId } })).status, 403);
});

test('thiếu đăng nhập thì bị chặn, GET không đăng nhập trả danh sách rỗng', { skip }, async () => {
  const anon = client(); await anon.init();
  const guest = await anon.request('api/user/location-share.php');
  assert.equal(guest.body.loggedIn, false);
  assert.deepEqual(guest.body.results, []);
  const blocked = await anon.request('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: 'X' } });
  assert.equal(blocked.status, 401);
});
