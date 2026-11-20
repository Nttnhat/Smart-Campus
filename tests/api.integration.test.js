// Test tích hợp API PHP thật (cần PHP + MySQL đang chạy). Bỏ qua nếu không đặt SC_API_BASE.
//   php -S 127.0.0.1:8099 -t .        (config/config.local.php trỏ tới database test)
//   SC_API_BASE=http://127.0.0.1:8099 SC_ADMIN_USER=admin SC_ADMIN_PASS=admin node --test tests/api.integration.test.js
// User journeys:
// 1) Khách: không đăng nhập vẫn lấy được danh sách địa điểm, đồ thị đường, ghi log tìm kiếm/lộ trình.
// 2) Request thay đổi dữ liệu không có CSRF token -> 419.
// 3) Sinh viên: đăng ký -> đăng nhập -> yêu thích -> lịch sử -> sửa hồ sơ -> đăng xuất.
// 4) Admin: sai mật khẩu -> 401; đúng -> CRUD địa điểm có audit log; API admin chặn người chưa đăng nhập.

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.SC_API_BASE;
const skip = !BASE && 'đặt SC_API_BASE để chạy test tích hợp';

function client() {
  let cookie = '';
  let csrf = '';
  async function request(path, { method = 'GET', data, headers = {}, withCsrf = true } = {}) {
    const h = { Accept: 'application/json', ...headers };
    if (cookie) h.Cookie = cookie;
    if (method !== 'GET' && withCsrf) h['X-CSRF-Token'] = csrf;
    if (data) h['Content-Type'] = 'application/json';
    const res = await fetch(BASE + '/' + path, { method, headers: h, body: data ? JSON.stringify(data) : undefined, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(',').map(c => c.split(';')[0].trim()).filter(c => c.startsWith('PHPSESSID')).pop() || cookie;
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (_) { /* HTML */ }
    return { status: res.status, body, headers: res.headers };
  }
  async function init() {
    const page = await request('home.php');
    const m = /name="csrf-token" content="([a-f0-9]+)"/.exec(page.body);
    assert.ok(m, 'home.php phải in meta csrf-token');
    csrf = m[1];
  }
  return { request, init, get csrf() { return csrf; } };
}

test('khách dùng được dữ liệu bản đồ mà không cần đăng nhập', { skip }, async () => {
  const c = client();
  await c.init();
  const places = await c.request('api/places.php');
  assert.equal(places.status, 200);
  assert.ok(places.body.results.length > 10);
  const me = await c.request('api/user/me.php');
  assert.equal(me.body.loggedIn, false);
  const log = await c.request('api/log.php', { method: 'POST', data: { type: 'search', keyword: 'toa a', result_count: 3 } });
  assert.equal(log.status, 201);
  const route = await c.request('api/log.php', { method: 'POST', data: { type: 'route', origin_type: 'gps', origin_lat: 10.7321234, origin_lng: 106.6991234, dest_slug: 'toa-a', dest_lat: 10.7319, dest_lng: 106.6991, distance_m: 120, duration_s: 90 } });
  assert.equal(route.status, 201);
});

test('thiếu CSRF token thì bị từ chối (419)', { skip }, async () => {
  const c = client();
  await c.init();
  const res = await c.request('api/log.php', { method: 'POST', data: { type: 'search', keyword: 'x' }, withCsrf: false });
  assert.equal(res.status, 419);
});

test('sinh viên: đăng ký, yêu thích, lịch sử, sửa hồ sơ, đăng xuất', { skip }, async () => {
  const c = client();
  await c.init();
  const code = 'T' + Date.now().toString().slice(-9);
  const bad = await c.request('api/user/register.php', { method: 'POST', data: { student_code: code, full_name: 'A', password: '123' } });
  assert.equal(bad.status, 400);

  const reg = await c.request('api/user/register.php', { method: 'POST', data: { student_code: code, full_name: 'Sinh Viên Test', password: 'matkhau123' } });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const dup = await c.request('api/user/register.php', { method: 'POST', data: { student_code: code, full_name: 'X', password: 'matkhau123' } });
  assert.equal(dup.status, 409);

  const me = await c.request('api/user/me.php');
  assert.equal(me.body.loggedIn, true);
  assert.equal(me.body.user.student_code, code);

  const fav = await c.request('api/user/favorites.php', { method: 'POST', data: { slug: 'toa-a', action: 'add' } });
  assert.equal(fav.status, 200);
  const favs = await c.request('api/user/favorites.php');
  assert.deepEqual(favs.body.results.map(f => f.id), ['toa-a']);

  await c.request('api/log.php', { method: 'POST', data: { type: 'search', keyword: 'thu vien', selected_slug: 'toa-g', result_count: 1 } });
  const hist = await c.request('api/user/history.php');
  assert.equal(hist.body.searches[0].keyword, 'thu vien');

  const wrongPw = await c.request('api/user/profile.php', { method: 'POST', data: { full_name: 'Tên Mới', current_password: 'sai', new_password: 'matkhaumoi1' } });
  assert.equal(wrongPw.status, 403);
  const upd = await c.request('api/user/profile.php', { method: 'POST', data: { full_name: 'Tên Mới', current_password: 'matkhau123', new_password: 'matkhaumoi1' } });
  assert.equal(upd.status, 200);

  const page = await c.request('home.php');
  assert.match(page.body, /Tên Mới/);
  const out = await c.request(`api/logout.php?role=user&t=${c.csrf}`);
  assert.equal(out.status, 302);
  assert.equal((await c.request('api/user/me.php')).body.loggedIn, false);

  const c2 = client();
  await c2.init();
  const relog = await c2.request('api/user/login.php', { method: 'POST', data: { student_code: code, password: 'matkhaumoi1' } });
  assert.equal(relog.status, 200);
});

test('admin: chặn khi chưa đăng nhập, đăng nhập đúng thì CRUD địa điểm có audit log', { skip }, async () => {
  const c = client();
  await c.init();
  const blocked = await c.request('api/admin/places.php', { method: 'POST', data: { action: 'create' } });
  assert.equal(blocked.status, 401);
  const page = await c.request('admin.php');
  assert.equal(page.status, 302);

  const wrong = await c.request('api/login.php', { method: 'POST', data: { username: 'admin', password: 'sai-mat-khau' } });
  assert.equal(wrong.status, 401);
  const ok = await c.request('api/login.php', { method: 'POST', data: { username: process.env.SC_ADMIN_USER || 'admin', password: process.env.SC_ADMIN_PASS || 'admin' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const slug = 'test-' + Date.now();
  const created = await c.request('api/admin/places.php', { method: 'POST', data: { action: 'create', slug, name: 'Điểm thử', category_code: 'tien-ich', lat: 10.7315, lng: 106.6985, aliases: ['diem thu'] } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const search = await c.request('api/search.php?q=diem%20thu');
  assert.ok(search.body.results.some(r => r.slug === slug));

  const updated = await c.request('api/admin/places.php', { method: 'POST', data: { action: 'update', slug, name: 'Điểm thử 2', category_code: 'tien-ich', lat: 10.7316, lng: 106.6986 } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const removed = await c.request('api/admin/places.php', { method: 'POST', data: { action: 'delete', slug } });
  assert.equal(removed.status, 200);
  const after = await c.request('api/places.php');
  assert.ok(!after.body.results.some(p => p.id === slug));

  // Đồ thị đường: thêm lối đi mới -> router thấy ngay; tắt -> biến mất; xoá.
  const edge = await c.request('api/admin/road-edges.php', { method: 'POST', data: { action: 'create', type: 'footway', a: { lat: 10.73150, lng: 106.69850 }, b: { lat: 10.73160, lng: 106.69860 } } });
  assert.equal(edge.status, 201, JSON.stringify(edge.body));
  const hasEdge = async () => (await c.request('api/road-graph.php')).body.edges.some(e => e[0] === edge.body.id);
  assert.equal(await hasEdge(), true);
  assert.equal((await c.request('api/admin/road-edges.php', { method: 'POST', data: { action: 'toggle', id: edge.body.id, active: false } })).status, 200);
  assert.equal(await hasEdge(), false);
  assert.equal((await c.request('api/admin/road-edges.php', { method: 'POST', data: { action: 'delete', id: edge.body.id } })).status, 200);

  // Lối vào + tầng/phòng của Tòa A.
  const ent = await c.request('api/admin/entrances.php', { method: 'POST', data: { action: 'create', place: 'toa-a', name: 'Cửa thử', type: 'side', lat: 10.7320, lng: 106.6990 } });
  assert.equal(ent.status, 201, JSON.stringify(ent.body));
  assert.ok((await c.request('api/entrances.php?building=toa-a')).body.results.length >= 1);
  assert.equal((await c.request('api/admin/entrances.php', { method: 'POST', data: { action: 'delete', id: ent.body.id } })).status, 200);
  const outside = await c.request('api/admin/entrances.php', { method: 'POST', data: { action: 'create', place: 'toa-a', lat: 21.03, lng: 105.85 } });
  assert.equal(outside.status, 400, 'toạ độ ngoài campus phải bị từ chối');

  const floors = await c.request('api/admin/floors.php?building=toa-a');
  assert.ok(floors.body.floors.length > 0);
  const floorId = floors.body.floors[0].id;
  const room = await c.request('api/admin/floors.php', { method: 'POST', data: { action: 'create_room', floor_id: floorId, code: 'TST' + (Date.now() % 1000), room_type: 'classroom', capacity: 40 } });
  assert.equal(room.status, 201, JSON.stringify(room.body));
  const f0 = floors.body.floors[0];
  const floorBase = { action: 'update_floor', building: 'toa-a', id: floorId, level: f0.level, name: f0.name };
  // SVG có JS -> được làm sạch rồi lưu; nội dung không phải SVG -> 400.
  const svg = await c.request('api/admin/floors.php', { method: 'POST', data: { ...floorBase, floor_plan_svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect id="A304" width="10" height="10"/></svg>' } });
  assert.equal(svg.status, 200, JSON.stringify(svg.body));
  const afterSvg = (await c.request('api/admin/floors.php?building=toa-a')).body.floors.find(f => f.id === floorId);
  assert.equal(afterSvg.plan_type, 'svg');
  const stored = Buffer.from(afterSvg.plan_src.split(',')[1], 'base64').toString();
  assert.match(stored, /id="A304"/);
  assert.doesNotMatch(stored, /script|onload/);
  assert.equal((await c.request('api/admin/floors.php', { method: 'POST', data: { ...floorBase, floor_plan_svg: '<html></html>' } })).status, 400);
  // Sơ đồ bằng link Google Drive.
  const driveId = '1AbCdEfGhIjKlMnOpQrStUvWxYz_012345';
  const driveDisplay = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
  assert.equal((await c.request('api/admin/floors.php', { method: 'POST', data: { ...floorBase, floor_plan_url: `https://drive.google.com/file/d/${driveId}/view?usp=sharing` } })).status, 200);
  const afterUrl = (await c.request('api/admin/floors.php?building=toa-a')).body.floors.find(f => f.id === floorId);
  // Sơ đồ tầng được thu nhỏ còn w1080 (ảnh địa điểm thì giữ w1600, kiểm tra bên dưới).
  assert.equal(afterUrl.plan_src, driveDisplay.replace('w1600', 'w1080'));
  // Ghim phòng lên sơ đồ.
  assert.equal((await c.request('api/admin/floors.php', { method: 'POST', data: { action: 'set_room_pin', id: room.body.id, plan_x: 150, plan_y: 20 } })).status, 400);
  assert.equal((await c.request('api/admin/floors.php', { method: 'POST', data: { action: 'set_room_pin', id: room.body.id, plan_x: 42.5, plan_y: 60 } })).status, 200);
  const pinned = (await c.request('api/admin/floors.php?building=toa-a')).body.floors.find(f => f.id === floorId).rooms.find(r => r.id === room.body.id);
  assert.equal(Number(pinned.plan_x), 42.5);
  const detail = await c.request('building-details.php?slug=toa-a');
  assert.match(detail.body, /"plan_x":42\.5/);
  assert.equal((await c.request('api/admin/floors.php', { method: 'POST', data: { ...floorBase, clear_plan: true } })).status, 200);
  assert.equal((await c.request('api/admin/floors.php', { method: 'POST', data: { action: 'delete_room', id: room.body.id } })).status, 200);

  // Ảnh địa điểm bằng link Drive; link thư mục bị từ chối.
  const placeBase = { action: 'update', slug, name: 'Điểm thử 2', category_code: 'tien-ich', lat: 10.7316, lng: 106.6986 };
  assert.equal((await c.request('api/admin/places.php', { method: 'POST', data: { ...placeBase, image_url: 'https://drive.google.com/drive/folders/1xyzFolderIdAbcdefghijkl' } })).status, 400);
  assert.equal((await c.request('api/admin/places.php', { method: 'POST', data: { ...placeBase, image_url: `https://drive.google.com/file/d/${driveId}/view` } })).status, 200);
  const withImage = (await c.request('api/admin/places.php')).body.results.find(p => p.id === slug);
  assert.equal(withImage.image_url, driveDisplay);

  const users = await c.request('api/admin/users.php');
  assert.ok(Array.isArray(users.body.results));

  const audit = await c.request('api/admin/audit.php');
  assert.ok(audit.body.results.slice(0, 15).some(a => a.entity === 'places'));
  assert.ok(audit.body.results.slice(0, 15).some(a => a.entity === 'road_edges'));
  const stats = await c.request('api/admin/stats.php');
  assert.ok(stats.body.totals.places > 10);
});
