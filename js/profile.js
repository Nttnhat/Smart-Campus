// Trang hồ sơ sinh viên: thông tin, yêu thích, lịch sử, cập nhật hồ sơ/mật khẩu.
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch } = window.SCApi;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const fmtDate = s => s ? new Date(s.replace(' ', 'T')).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const fmtDist = m => m == null ? '' : (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
  const routeLink = (lat, lng, name) => `navigation.php?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&name=${encodeURIComponent(name)}`;

  function renderList(el, items, renderItem, emptyText) {
    el.innerHTML = items.length ? items.map(renderItem).join('') : `<li class="empty">${esc(emptyText)}</li>`;
  }

  async function loadMe() {
    const me = await apiFetch('api/user/me.php');
    if (!me.loggedIn) { window.location.href = 'login.php?next=profile.php'; return; }
    const u = me.user;
    $('profileName').textContent = u.full_name;
    $('profileCode').textContent = u.student_code;
    $('profileCreated').textContent = fmtDate(u.created_at);
    $('profileInitials').textContent = u.full_name.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
    $('editFullName').value = u.full_name;
    $('editEmail').value = u.email || '';
  }

  async function loadFavorites() {
    const data = await apiFetch('api/user/favorites.php');
    renderList($('favoritesList'), data.results, f => `
      <li>
        <div><strong>${esc(f.name)}</strong><span>${esc(f.category)}</span></div>
        <div class="item-actions">
          <a class="item-action" href="${routeLink(f.lat, f.lng, f.name)}">Tìm đường</a>
          <button type="button" class="item-action danger" data-remove="${esc(f.id)}" aria-label="Bỏ yêu thích ${esc(f.name)}">Bỏ</button>
        </div>
      </li>`, 'Chưa có địa điểm yêu thích.');
  }

  async function loadHistory() {
    const data = await apiFetch('api/user/history.php');
    renderList($('routesList'), data.routes, r => {
      const name = r.dest_name || 'Điểm đã chọn';
      const origin = r.origin_type === 'gps' ? 'Vị trí GPS' : (r.origin_name || 'Điểm chọn trên bản đồ');
      return `<li>
        <div><strong>${esc(origin)} → ${esc(name)}</strong><span>${esc(fmtDist(Number(r.distance_m)))} · ${esc(fmtDate(r.created_at))}</span></div>
        ${r.dest_lat != null ? `<a class="item-action" href="${routeLink(r.dest_lat, r.dest_lng, name)}">Đi lại</a>` : ''}
      </li>`;
    }, 'Chưa có lộ trình nào.');
    renderList($('searchesList'), data.searches, s => `
      <li><div><strong>${esc(s.keyword || s.place_name)}</strong><span>${s.place_name ? `Đã chọn: ${esc(s.place_name)} · ` : ''}${esc(fmtDate(s.created_at))}</span></div></li>`,
      'Chưa có lượt tìm kiếm nào.');
  }

  const shareStatusLabel = { pending: 'Đang chờ', active: 'Đang chia sẻ', expired: 'Đã hết hạn' };

  async function loadShares() {
    const data = await apiFetch('api/user/location-share.php');
    renderList($('shareList'), data.results, s => {
      const label = shareStatusLabel[s.status] || s.status;
      const actions = [];
      if (s.status === 'pending' && s.direction === 'incoming') {
        actions.push(`<button type="button" class="item-action" data-accept="${s.id}">Chấp nhận</button>`);
        actions.push(`<button type="button" class="item-action danger" data-decline="${s.id}">Từ chối</button>`);
      } else if (s.status === 'pending' || s.status === 'active') {
        actions.push(`<button type="button" class="item-action danger" data-stop="${s.id}">Dừng</button>`);
      }
      return `<li>
        <div><strong>${esc(s.otherName)}</strong><span>${esc(label)}${s.direction === 'outgoing' ? ' · bạn đã mời' : ' · đã mời bạn'}</span></div>
        <div class="item-actions">${actions.join('')}</div>
      </li>`;
    }, 'Chưa có lời mời/phiên chia sẻ nào.');
  }

  $('shareInviteForm').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('shareInviteStatus');
    const code = $('shareInviteCode').value.trim();
    if (!code) { status.textContent = 'Nhập MSSV.'; status.dataset.state = 'error'; return; }
    try {
      await apiFetch('api/user/location-share.php', { method: 'POST', data: { action: 'invite', student_code: code } });
      status.textContent = 'Đã gửi lời mời.';
      status.dataset.state = 'ok';
      $('shareInviteCode').value = '';
      await loadShares();
    } catch (err) {
      status.textContent = err.message;
      status.dataset.state = 'error';
    }
  });

  $('shareList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-accept], [data-decline], [data-stop]');
    if (!btn) return;
    const action = btn.dataset.accept ? 'accept' : (btn.dataset.decline ? 'decline' : 'stop');
    const id = btn.dataset.accept || btn.dataset.decline || btn.dataset.stop;
    btn.disabled = true;
    try {
      await apiFetch('api/user/location-share.php', { method: 'POST', data: { action, id: Number(id) } });
      await loadShares();
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  });

  $('favoritesList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    btn.disabled = true;
    try {
      await apiFetch('api/user/favorites.php', { method: 'POST', data: { slug: btn.dataset.remove, action: 'remove' } });
      await loadFavorites();
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  });

  $('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('profileStatus');
    const data = {
      full_name: $('editFullName').value.trim(),
      email: $('editEmail').value.trim(),
      current_password: $('currentPassword').value,
      new_password: $('newPassword').value,
    };
    if (!data.full_name) { status.textContent = 'Họ tên không được trống.'; status.dataset.state = 'error'; return; }
    if (data.new_password && data.new_password.length < 8) { status.textContent = 'Mật khẩu mới phải có ít nhất 8 ký tự.'; status.dataset.state = 'error'; return; }
    try {
      await apiFetch('api/user/profile.php', { method: 'POST', data });
      status.textContent = 'Đã lưu.';
      status.dataset.state = 'ok';
      $('currentPassword').value = '';
      $('newPassword').value = '';
      await loadMe();
    } catch (err) {
      status.textContent = err.message;
      status.dataset.state = 'error';
    }
  });

  try {
    await loadMe();
    await Promise.all([loadFavorites(), loadHistory(), loadShares()]);
  } catch (err) {
    $('profileName').textContent = 'Không tải được hồ sơ';
    console.warn(err);
  }
});
