// Trang chi tiết tòa nhà: chuyển tầng, tìm phòng trong tòa, đánh dấu phòng (?room=A304).
// Dữ liệu tầng/phòng được PHP in sẵn vào window.BUILDING_DATA (không cần gọi API thêm).
document.addEventListener('DOMContentLoaded', () => {
  const data = window.BUILDING_DATA;
  if (!data || !data.floors.length) return;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const TYPES = data.roomTypes;
  const buttons = [...document.querySelectorAll('.floor-btn')];
  const title = document.getElementById('floorTitle');
  const plan = document.getElementById('floorPlanArea');
  const search = document.getElementById('roomSearch');
  const results = document.getElementById('roomSearchResults');
  let current = null;

  function renderFloor(floorId, highlight = null) {
    const floor = data.floors.find(f => f.id === floorId) || data.floors[0];
    current = floor;
    buttons.forEach(b => {
      const on = Number(b.dataset.floor) === floor.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    title.textContent = `${floor.name} - ${data.name}`;
    // Sơ đồ (SVG hoặc ảnh Google Drive) + ghim phòng đặt theo % -> co giãn đúng theo kích thước ảnh.
    const pins = floor.rooms.filter(r => r.plan_x != null && r.plan_y != null).map(r => `
      <button type="button" class="plan-pin${highlight && r.code === highlight ? ' active' : ''}" data-pin="${esc(r.code)}"
        style="left:${Number(r.plan_x)}%;top:${Number(r.plan_y)}%" title="${esc(r.code)}${r.name ? ' - ' + esc(r.name) : ''}">${esc(r.code)}</button>`).join('');
    const svg = floor.planSrc ? `<div class="plan-wrap"><img class="floor-svg" src="${esc(floor.planSrc)}" alt="Sơ đồ ${esc(floor.name)}" referrerpolicy="no-referrer"
        onerror="this.closest('.plan-wrap').innerHTML='<p class=&quot;empty-floor&quot;>Không tải được ảnh sơ đồ (kiểm tra quyền chia sẻ trên Google Drive).</p>'">${pins}</div>` : '';
    const groups = {};
    floor.rooms.forEach(r => { (groups[r.room_type] = groups[r.room_type] || []).push(r); });
    const cards = Object.keys(groups).length ? Object.entries(groups).map(([type, rooms]) => `
      <section class="room-group">
        <h4>${esc(TYPES[type] || type)} <small>(${rooms.length})</small></h4>
        <div class="room-grid">${rooms.map(r => `
          <div class="room-card type-${esc(r.room_type)}${highlight && r.code === highlight ? ' highlight' : ''}${r.status !== 'active' ? ' inactive' : ''}" id="room-${esc(r.code)}" tabindex="-1">
            <strong>${esc(r.code)}</strong>
            ${r.name ? `<span>${esc(r.name)}</span>` : ''}
            ${r.capacity ? `<small>${r.capacity} chỗ</small>` : ''}
            ${r.status !== 'active' ? `<small class="room-status">${esc(data.statuses[r.status] || r.status)}</small>` : ''}
          </div>`).join('')}</div>
      </section>`).join('') : '<p class="empty-floor">Tầng này chưa có dữ liệu phòng.</p>';
    plan.innerHTML = svg + cards;
    if (highlight) {
      const el = document.getElementById(`room-${highlight}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
    }
    const url = new URL(location.href);
    url.searchParams.set('floor', floor.level);
    if (highlight) url.searchParams.set('room', highlight); else url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }

  buttons.forEach(b => b.addEventListener('click', () => renderFloor(Number(b.dataset.floor))));
  plan.addEventListener('click', e => {
    const pin = e.target.closest('[data-pin]');
    if (pin && current) renderFloor(current.id, pin.dataset.pin);
  });

  function findRooms(q) {
    const nq = q.trim().toUpperCase();
    if (!nq) return [];
    const out = [];
    data.floors.forEach(f => f.rooms.forEach(r => {
      if (r.code.toUpperCase().includes(nq) || String(r.name || '').toUpperCase().includes(nq)) out.push({ ...r, floor: f });
    }));
    return out.slice(0, 12);
  }
  search.addEventListener('input', () => {
    const list = findRooms(search.value);
    results.hidden = !search.value.trim();
    results.innerHTML = list.length ? list.map(r => `<li><button type="button" data-floor="${r.floor.id}" data-room="${esc(r.code)}"><strong>${esc(r.code)}</strong> ${esc(r.name || '')} <small>${esc(r.floor.name)}</small></button></li>`).join('')
      : '<li class="empty">Không có phòng phù hợp trong tòa này</li>';
  });
  results.addEventListener('click', e => {
    const b = e.target.closest('[data-room]');
    if (!b) return;
    results.hidden = true;
    search.value = b.dataset.room;
    renderFloor(Number(b.dataset.floor), b.dataset.room);
  });

  const params = new URLSearchParams(location.search);
  const room = (params.get('room') || '').toUpperCase();
  const roomFloor = room && data.floors.find(f => f.rooms.some(r => r.code.toUpperCase() === room));
  const levelFloor = params.has('floor') && data.floors.find(f => String(f.level) === params.get('floor'));
  renderFloor((roomFloor || levelFloor || data.floors[0]).id, roomFloor ? room : null);
});
