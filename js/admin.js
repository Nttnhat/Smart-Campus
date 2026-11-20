// Trang quản trị: mọi thao tác gọi api/admin/*.php (session admin + CSRF, ghi audit_logs).
document.addEventListener('DOMContentLoaded', () => {
  const VM = window.TDTUVectorMap;
  const { apiFetch } = window.SCApi;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const fmtDate = s => s ? new Date(String(s).replace(' ', 'T')).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const STATUS = { active: 'Hoạt động', maintenance: 'Bảo trì', closed: 'Đóng cửa', locked: 'Đã khoá' };
  const ENTRANCE_TYPES = { main: 'Cửa chính', side: 'Cửa phụ', gate: 'Cổng', vehicle_in: 'Lối xe vào', vehicle_out: 'Lối xe ra' };
  const ROOM_TYPES = { classroom: 'Phòng học', lab: 'Phòng thí nghiệm', office: 'Văn phòng', support: 'Hỗ trợ', stairs: 'Thang bộ', elevator: 'Thang máy', wc: 'WC', corridor: 'Hành lang', other: 'Khác' };
  const EDGE_TYPES = { footway: 'Lối đi bộ', crossing: 'Vạch qua đường', steps: 'Bậc thang', service: 'Đường nội bộ (xe)', road: 'Đường lớn' };

  // ---------- Thông báo ----------
  let noticeTimer = null;
  function notify(text, isError = false) {
    const n = $('adminNotice');
    n.textContent = text;
    n.dataset.state = isError ? 'error' : 'ok';
    n.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { n.hidden = true; }, 4000);
  }
  async function call(url, data, okText) {
    try {
      const res = await apiFetch(url, { method: 'POST', data });
      if (okText) notify(okText);
      return res;
    } catch (err) {
      notify(err.message, true);
      if (err.status === 401) location.href = 'login.php?role=admin';
      throw err;
    }
  }

  // ---------- Hộp thoại form dùng chung ----------
  // fields: [{name, label, type:'text'|'number'|'select'|'textarea'|'color'|'hidden'|'map', value, options, required, ...}]
  let modalSubmit = null;
  let modalMap = null;
  function openModal(title, fields, onSubmit) {
    $('modalTitle').textContent = title;
    $('modalSave').textContent = 'Lưu';
    $('modalError').hidden = true;
    const form = $('modalForm');
    form.innerHTML = fields.map(f => {
      const id = `f_${f.name}`;
      const req = f.required ? 'required' : '';
      if (f.type === 'hidden') return `<input type="hidden" id="${id}" value="${esc(f.value)}">`;
      if (f.type === 'map') return `<div class="field-full"><span class="field-label">${esc(f.label)}</span><div id="modalMap" class="admin-map admin-map-small"></div><small class="field-hint">Bấm hoặc kéo chấm đỏ để chọn toạ độ.</small></div>`;
      if (f.type === 'select') return `<label class="${f.full ? 'field-full' : ''}">${esc(f.label)}<select id="${id}" ${req}>${Object.entries(f.options).map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
      if (f.type === 'textarea') return `<label class="field-full">${esc(f.label)}<textarea id="${id}" rows="${f.rows || 3}" ${req}>${esc(f.value)}</textarea></label>`;
      if (f.type === 'file') return `<label class="field-full">${esc(f.label)}<input type="file" id="${id}" accept="${esc(f.accept || '')}">${f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : ''}</label>`;
      const list = f.datalist ? `<datalist id="${id}_list">${f.datalist.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
      // preview: ô nhập link ảnh (Google Drive / https) có xem trước ngay bên dưới.
      const preview = f.preview ? `<small class="field-hint" id="${id}_msg">${esc(f.hint || '')}</small><img id="${id}_preview" class="image-preview" alt="Xem trước" referrerpolicy="no-referrer" hidden>` : '';
      return `<label class="${f.full ? 'field-full' : ''}">${esc(f.label)}<input type="${f.type || 'text'}" id="${id}" value="${esc(f.value)}" ${req} ${f.readonly ? 'readonly' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.datalist ? `list="${id}_list"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>${list}${preview}</label>`;
    }).join('');
    modalSubmit = () => {
      const values = {};
      for (const f of fields) {
        if (f.type === 'map') continue;
        const el = $(`f_${f.name}`);
        if (f.type === 'file') { values[f.name] = el.files[0] || null; continue; }
        values[f.name] = f.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim();
        if (f.required && values[f.name] === '') throw new Error(`Hãy nhập "${f.label}"`);
      }
      return onSubmit(values);
    };
    $('modalOverlay').hidden = false;
    const mapField = fields.find(f => f.type === 'map');
    if (mapField) setupModalMap(mapField);
    fields.filter(f => f.preview).forEach(f => wireImagePreview(`f_${f.name}`, f.hint || ''));
    const first = form.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
    if (first) first.focus();
  }
  function setupModalMap(field) {
    if (modalMap) { modalMap.remove(); modalMap = null; }
    const latEl = $(`f_${field.latField}`), lngEl = $(`f_${field.lngField}`);
    const start = [Number(latEl.value) || VM.CAMPUS_CENTER[0], Number(lngEl.value) || VM.CAMPUS_CENTER[1]];
    modalMap = VM.createBaseMap('modalMap', { minZoom: 16 });
    VM.addRealBasemap(modalMap);
    modalMap.setView(start, 18);
    const marker = L.marker(start, { draggable: true }).addTo(modalMap);
    const sync = ll => { latEl.value = ll.lat.toFixed(7); lngEl.value = ll.lng.toFixed(7); };
    marker.on('dragend', () => sync(marker.getLatLng()));
    modalMap.on('click', e => { marker.setLatLng(e.latlng); sync(e.latlng); });
    const move = () => { const ll = [Number(latEl.value), Number(lngEl.value)]; if (ll.every(Number.isFinite)) { marker.setLatLng(ll); modalMap.panTo(ll); } };
    latEl.addEventListener('change', move); lngEl.addEventListener('change', move);
    setTimeout(() => modalMap.invalidateSize(), 50);
  }
  // Xem trước link ảnh: đổi link chia sẻ Google Drive sang link hiển thị (js/lib/drive-link.js).
  function wireImagePreview(id, hint) {
    const input = $(id), img = $(`${id}_preview`), msg = $(`${id}_msg`);
    const update = () => {
      const r = window.DriveLink.toDisplayUrl(input.value);
      msg.dataset.state = r.ok ? '' : 'error';
      if (!r.ok) { img.hidden = true; msg.textContent = r.error; return; }
      msg.textContent = r.driveId ? 'Link Google Drive hợp lệ. Nếu ảnh không hiện: trên Drive chọn Chia sẻ → "Bất kỳ ai có đường liên kết".' : hint;
      img.hidden = !r.url;
      if (r.url) img.src = r.url;
    };
    img.addEventListener('error', () => {
      img.hidden = true;
      msg.dataset.state = 'error';
      msg.textContent = 'Không tải được ảnh. Kiểm tra file trên Drive đã chia sẻ "Bất kỳ ai có đường liên kết" chưa.';
    });
    input.addEventListener('input', update);
    update();
  }
  function closeModal() {
    $('modalOverlay').hidden = true;
    modalSubmit = null;
    if (modalMap) { modalMap.remove(); modalMap = null; }
  }
  $('modalCancel').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modalOverlay').hidden) closeModal(); });
  $('modalSave').addEventListener('click', async () => {
    if (!modalSubmit) return;
    const btn = $('modalSave');
    btn.disabled = true;
    try {
      await modalSubmit();
      closeModal();
    } catch (err) {
      $('modalError').textContent = err.message;
      $('modalError').hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Điều hướng giữa các mục ----------
  const loaders = {};
  const loaded = new Set();
  function showView(view) {
    if (!document.getElementById(`view-${view}`)) view = 'dashboard';
    document.querySelectorAll('.admin-menu a[data-view]').forEach(a => {
      const active = a.dataset.view === view;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.admin-view').forEach(s => { s.hidden = s.id !== `view-${view}`; });
    if (loaders[view] && !loaded.has(view)) { loaded.add(view); loaders[view](); }
    if (view === 'roads' && roadMap) setTimeout(() => roadMap.invalidateSize(), 50);
    if (view === 'entrances' && entranceMap) setTimeout(() => entranceMap.invalidateSize(), 50);
  }
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-view], [data-view-link]');
    if (!link) return;
    e.preventDefault();
    const view = link.dataset.view || link.dataset.viewLink;
    history.replaceState(null, '', `#${view}`);
    showView(view);
  });

  // ---------- Tổng quan ----------
  loaders.dashboard = async () => {
    const s = await apiFetch('api/admin/stats.php');
    const t = s.totals;
    const cards = [
      ['Địa điểm', t.places], ['Tòa nhà', t.buildings], ['Phòng', t.rooms],
      ['Địa điểm có lối vào', t.places_with_entrances], ['Đoạn đường đang dùng', t.edges_active],
      ['Tài khoản người dùng', t.users], ['Tìm kiếm (7 ngày)', t.searches_7d], ['Dẫn đường (7 ngày)', t.routes_7d],
    ];
    $('statsGrid').innerHTML = cards.map(([label, value]) => `<div class="stat-card"><div class="stat-info"><h3>${Number(value).toLocaleString('vi-VN')}</h3><p>${esc(label)}</p></div></div>`).join('');
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
    const byDay = Object.fromEntries(s.daily.map(r => [r.d, r]));
    const max = Math.max(1, ...s.daily.map(r => Math.max(Number(r.searches), Number(r.routes))));
    $('dailyChart').innerHTML = days.map(d => {
      const r = byDay[d] || { searches: 0, routes: 0 };
      return `<div class="bar-col" title="${d}: ${r.searches} tìm kiếm, ${r.routes} dẫn đường">
        <div class="bars"><span class="bar bar-search" style="height:${(r.searches / max) * 100}%"></span><span class="bar bar-route" style="height:${(r.routes / max) * 100}%"></span></div>
        <small>${d.slice(8)}/${d.slice(5, 7)}</small></div>`;
    }).join('');
    const rank = (el, rows, label) => { $(el).innerHTML = rows.length ? rows.map(r => `<li><span>${esc(r[label])}</span><strong>${r.total}</strong></li>`).join('') : '<li class="empty">Chưa có dữ liệu</li>'; };
    rank('topDestinations', s.topDestinations, 'name');
    rank('topKeywords', s.topKeywords, 'keyword');
    rank('missedKeywords', s.missedKeywords, 'keyword');
  };

  // ---------- Địa điểm ----------
  let places = [], categories = [], labels = [];
  async function loadPlaces() {
    const data = await apiFetch('api/admin/places.php');
    places = data.results; categories = data.categories; labels = data.labels;
    renderPlaces();
    fillPlaceSelects();
  }
  loaders.places = loadPlaces;
  function renderPlaces() {
    const q = VM.normalise($('placeSearchInput').value);
    const showHidden = $('showHiddenPlaces').checked;
    const rows = places.filter(p => (showHidden || p.is_active) && (!q || [p.name, p.id, p.category, ...(p.aliases || [])].some(v => VM.normalise(v).includes(q))));
    $('placesTableBody').innerHTML = rows.length ? rows.map(p => `
      <tr class="${p.is_active ? '' : 'row-hidden'}">
        <td><strong>${esc(p.name)}</strong>${p.is_building ? ` <span class="tag">Tòa ${esc(p.building_code)}</span>` : ''}</td>
        <td>${esc(p.category)}</td>
        <td>${p.entrance_count}</td>
        <td><span class="badge-status status-${p.is_active ? esc(p.status) : 'maintenance'}">${p.is_active ? esc(STATUS[p.status] || p.status) : 'Đang ẩn'}</span></td>
        <td class="action-btns">
          <button type="button" class="btn-icon" data-place-edit="${esc(p.id)}">Sửa</button>
          <button type="button" class="btn-icon" data-place-toggle="${esc(p.id)}">${p.is_active ? 'Ẩn' : 'Hiện'}</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty-cell">Không có địa điểm phù hợp</td></tr>';
  }
  $('placeSearchInput').addEventListener('input', renderPlaces);
  $('showHiddenPlaces').addEventListener('change', renderPlaces);

  function placeForm(p) {
    const isNew = !p;
    p = p || { id: '', name: '', category: '', category_code: categories[0]?.code, aliases: [], description: '', image_url: '', lat: VM.CAMPUS_CENTER[0], lng: VM.CAMPUS_CENTER[1], status: 'active' };
    openModal(isNew ? 'Thêm địa điểm' : `Sửa: ${p.name}`, [
      { name: 'name', label: 'Tên hiển thị', value: p.name, required: true, full: true },
      { name: 'slug', label: 'Mã (slug, không dấu)', value: p.id, required: true, readonly: !isNew, placeholder: 'vd: toa-n' },
      { name: 'category_code', label: 'Danh mục', type: 'select', value: p.category_code, options: Object.fromEntries(categories.map(c => [c.code, c.name])) },
      { name: 'category_label', label: 'Nhãn hiển thị (dùng để lọc nhãn bản đồ)', value: p.category, datalist: labels },
      { name: 'status', label: 'Trạng thái', type: 'select', value: p.status, options: { active: 'Hoạt động', maintenance: 'Bảo trì', closed: 'Đóng cửa' } },
      { name: 'aliases', label: 'Bí danh tìm kiếm (cách nhau dấu phẩy)', value: (p.aliases || []).join(', '), full: true, placeholder: 'vd: nha a, giang duong a' },
      { name: 'description', label: 'Mô tả (hiện ở trang chi tiết)', type: 'textarea', value: p.description || '' },
      { name: 'image_url', label: 'Ảnh (dán link Google Drive hoặc link https)', value: p.image_url || '', full: true, preview: true,
        placeholder: 'https://drive.google.com/file/d/.../view?usp=sharing', hint: 'Trên Drive: chuột phải ảnh → Chia sẻ → "Bất kỳ ai có đường liên kết" → Sao chép đường liên kết.' },
      { name: 'lat', label: 'Vĩ độ', type: 'number', step: '0.0000001', value: p.lat, required: true },
      { name: 'lng', label: 'Kinh độ', type: 'number', step: '0.0000001', value: p.lng, required: true },
      { name: 'pos', label: 'Vị trí trên bản đồ', type: 'map', latField: 'lat', lngField: 'lng' },
    ], async v => {
      const data = { action: isNew ? 'create' : 'update', ...v, aliases: v.aliases.split(',').map(s => s.trim()).filter(Boolean) };
      await call('api/admin/places.php', data, isNew ? 'Đã thêm địa điểm' : 'Đã lưu địa điểm');
      await loadPlaces();
    });
  }
  $('addPlaceBtn').addEventListener('click', () => placeForm(null));

  $('placesTableBody').addEventListener('click', async e => {
    const edit = e.target.closest('[data-place-edit]');
    const toggle = e.target.closest('[data-place-toggle]');
    if (edit) placeForm(places.find(p => p.id === edit.dataset.placeEdit));
    if (toggle) {
      const p = places.find(x => x.id === toggle.dataset.placeToggle);
      if (p.is_active && !confirm(`Ẩn "${p.name}" khỏi bản đồ và tìm kiếm? (có thể hiện lại sau)`)) return;
      await call('api/admin/places.php', { action: p.is_active ? 'delete' : 'restore', slug: p.id }, p.is_active ? 'Đã ẩn địa điểm' : 'Đã hiện lại địa điểm');
      await loadPlaces();
    }
  });

  function fillPlaceSelects() {
    const active = places.filter(p => p.is_active);
    const prevE = $('entrancePlaceSelect').value, prevB = $('floorBuildingSelect').value;
    $('entrancePlaceSelect').innerHTML = active.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${p.entrance_count} lối vào)</option>`).join('');
    $('floorBuildingSelect').innerHTML = active.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.is_building ? ` · Tòa ${esc(p.building_code)}` : ' · chưa là tòa nhà'}</option>`).join('');
    if (prevE) $('entrancePlaceSelect').value = prevE;
    if (prevB) $('floorBuildingSelect').value = prevB;
  }

  // ---------- Lối vào ----------
  // Thay đổi (thêm/kéo/xoá) chỉ sửa mảng `entrances` cục bộ; chỉ gọi API khi bấm nút "Lưu lại".
  let entranceMap = null, entranceLayer = null, entrances = [], entranceDeleteIds = new Set(), entranceLastPlace = null;
  loaders.entrances = async () => {
    if (!places.length) await loadPlaces();
    entranceMap = VM.createBaseMap('entranceMap', { minZoom: 16 });
    VM.addRealBasemap(entranceMap);
    entranceLayer = L.layerGroup().addTo(entranceMap);
    entranceMap.on('click', e => {
      entrances.push({ id: `new_${Date.now()}_${Math.random()}`, name: null, type: $('entranceTypeSelect').value, lat: e.latlng.lat, lng: e.latlng.lng, _new: true });
      renderEntrances();
    });
    $('entrancePlaceSelect').addEventListener('change', () => {
      if (hasEntranceChanges() && !confirm('Có thay đổi lối vào chưa lưu. Chuyển địa điểm sẽ bỏ các thay đổi này?')) {
        $('entrancePlaceSelect').value = entranceLastPlace;
        return;
      }
      loadEntrances();
    });
    $('entranceSaveBtn').addEventListener('click', saveEntrances);
    await loadEntrances();
  };
  function hasEntranceChanges() {
    return entranceDeleteIds.size > 0 || entrances.some(en => en._new || en._dirty);
  }
  function renderEntrances() {
    const place = places.find(p => p.id === $('entrancePlaceSelect').value);
    entranceLayer.clearLayers();
    if (place) L.circleMarker([place.lat, place.lng], { radius: 7, color: '#00458C', fillColor: '#fff', fillOpacity: 1 }).bindTooltip(place.name, { permanent: true, direction: 'top' }).addTo(entranceLayer);
    entrances.forEach(en => {
      const m = L.marker([en.lat, en.lng], { draggable: true, title: ENTRANCE_TYPES[en.type] }).addTo(entranceLayer);
      m.bindTooltip(`${ENTRANCE_TYPES[en.type] || en.type}${en.name ? ': ' + en.name : ''}${en._new || en._dirty ? ' (chưa lưu)' : ''}`);
      m.on('dragend', () => {
        const ll = m.getLatLng();
        en.lat = ll.lat; en.lng = ll.lng;
        if (!en._new) en._dirty = true;
        renderEntrances();
      });
    });
    $('entranceList').innerHTML = entrances.length ? entrances.map(en => `
      <li><div><strong>${esc(ENTRANCE_TYPES[en.type] || en.type)}${en.name ? ' · ' + esc(en.name) : ''}${en._new || en._dirty ? ' <em>(chưa lưu)</em>' : ''}</strong><span>${Number(en.lat).toFixed(6)}, ${Number(en.lng).toFixed(6)}</span></div>
      <button type="button" class="item-action danger" data-entrance-delete="${en.id}">Xoá</button></li>`).join('') : '<li class="empty">Chưa có lối vào - bấm lên bản đồ để thêm.</li>';
    $('entranceSaveBtn').disabled = !hasEntranceChanges();
  }
  async function loadEntrances() {
    const slug = $('entrancePlaceSelect').value;
    const place = places.find(p => p.id === slug);
    if (!place) return;
    const { results } = await apiFetch(`api/admin/entrances.php?place=${encodeURIComponent(slug)}`);
    entrances = results.map(en => ({ ...en }));
    entranceDeleteIds.clear();
    entranceLastPlace = slug;
    renderEntrances();
    entranceMap.setView([place.lat, place.lng], 19);
  }
  $('entranceList').addEventListener('click', e => {
    const btn = e.target.closest('[data-entrance-delete]');
    if (!btn || !confirm('Xoá lối vào này?')) return;
    const id = btn.dataset.entranceDelete;
    const idx = entrances.findIndex(en => String(en.id) === id);
    if (idx === -1) return;
    const [removed] = entrances.splice(idx, 1);
    if (!removed._new) entranceDeleteIds.add(removed.id);
    renderEntrances();
  });
  async function saveEntrances() {
    const slug = $('entrancePlaceSelect').value;
    try {
      for (const id of entranceDeleteIds) {
        await call('api/admin/entrances.php', { action: 'delete', id });
      }
      for (const en of entrances) {
        if (en._new) {
          await call('api/admin/entrances.php', { action: 'create', place: slug, type: en.type, name: en.name, lat: en.lat, lng: en.lng });
        } else if (en._dirty) {
          await call('api/admin/entrances.php', { action: 'update', id: en.id, place: slug, name: en.name, type: en.type, lat: en.lat, lng: en.lng });
        }
      }
      notify('Đã lưu toàn bộ thay đổi lối vào');
    } finally {
      entranceDeleteIds.clear();
      await loadEntrances();
      await loadPlaces();
    }
  }

  // ---------- Tầng & phòng ----------
  let floorData = null;
  loaders.floors = async () => {
    if (!places.length) await loadPlaces();
    const firstBuilding = places.find(p => p.is_building);
    if (firstBuilding) $('floorBuildingSelect').value = firstBuilding.id;
    $('floorBuildingSelect').addEventListener('change', loadFloors);
    await loadFloors();
  };
  async function loadFloors() {
    const slug = $('floorBuildingSelect').value;
    const place = places.find(p => p.id === slug);
    const box = $('floorsContainer');
    if (!place) { box.innerHTML = ''; return; }
    if (!place.is_building) {
      floorData = null;
      box.innerHTML = `<div class="table-container empty-state"><p>"${esc(place.name)}" chưa được đánh dấu là tòa nhà nên chưa có tầng/phòng.</p>
        <button type="button" class="btn btn-secondary" id="markBuildingBtn">Đánh dấu là tòa nhà</button></div>`;
      $('markBuildingBtn').addEventListener('click', () => openModal(`Đánh dấu tòa nhà: ${place.name}`, [
        { name: 'code', label: 'Mã tòa (vd: A, B, LIB)', value: '', required: true },
      ], async v => { await call('api/admin/floors.php', { action: 'set_building', place: slug, code: v.code }, 'Đã đánh dấu tòa nhà'); await loadPlaces(); await loadFloors(); }));
      return;
    }
    floorData = await apiFetch(`api/admin/floors.php?building=${encodeURIComponent(slug)}`);
    box.innerHTML = floorData.floors.length ? floorData.floors.map(f => `
      <div class="table-container floor-card">
        <div class="table-header">
          <h3 class="panel-title">${esc(f.name)} <small>(tầng số ${f.level}${f.has_plan ? ' · có sơ đồ' : ''})</small> <span class="badge-status status-${esc(f.status)}">${esc(STATUS[f.status] || f.status)}</span></h3>
          <div class="action-btns">
            <button type="button" class="btn-icon" data-floor-edit="${f.id}">Sửa tầng / sơ đồ</button>
            ${f.has_plan ? `<button type="button" class="btn-icon" data-floor-pins="${f.id}">Ghim phòng</button>` : ''}
            <button type="button" class="btn-icon" data-room-add="${f.id}">+ Phòng</button>
            <button type="button" class="btn-icon danger" data-floor-delete="${f.id}">Xoá tầng</button>
          </div>
        </div>
        <div class="table-scroll"><table><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${f.rooms.length ? f.rooms.map(r => `<tr><td><strong>${esc(r.code)}</strong></td><td>${esc(r.name)}</td><td>${esc(ROOM_TYPES[r.room_type] || r.room_type)}</td>
          <td><span class="badge-status status-${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span></td>
          <td class="action-btns"><button type="button" class="btn-icon" data-room-edit="${r.id}" data-floor="${f.id}">Sửa</button><button type="button" class="btn-icon danger" data-room-delete="${r.id}">Xoá</button></td></tr>`).join('')
        : '<tr><td colspan="5" class="empty-cell">Chưa có phòng</td></tr>'}
        </tbody></table></div>
      </div>`).join('') : '<div class="table-container empty-state"><p>Tòa này chưa có tầng nào.</p></div>';
  }
  function floorForm(f) {
    const slug = $('floorBuildingSelect').value;
    openModal(f ? `Sửa ${f.name}` : 'Thêm tầng', [
      { name: 'level', label: 'Số tầng (0 = trệt, -1 = hầm)', type: 'number', value: f ? f.level : '', required: true },
      { name: 'name', label: 'Tên tầng', value: f ? f.name : '', required: true, placeholder: 'vd: Tầng 3' },
      { name: 'status', label: 'Trạng thái', type: 'select', value: f ? f.status : 'active', options: { active: 'Hoạt động', maintenance: 'Bảo trì', closed: 'Đóng cửa' } },
      { name: 'plan_file', label: 'Sơ đồ tầng: tải file .svg', type: 'file', accept: '.svg,image/svg+xml',
        hint: f?.plan_type ? 'Tầng này đã có sơ đồ. Chọn file mới để thay, hoặc bỏ trống để giữ nguyên.' : 'Tối đa 2 MB. File được làm sạch trước khi lưu.' },
      { name: 'floor_plan_url', label: 'HOẶC link ảnh sơ đồ (Google Drive / https)', value: f?.plan_type === 'url' ? f.plan_src : '', full: true, preview: true,
        placeholder: 'https://drive.google.com/file/d/.../view' },
      { name: 'clear_plan', label: 'Sơ đồ hiện tại', type: 'select', value: '0', options: { 0: 'Giữ / thay bằng file hoặc link ở trên', 1: 'Xoá sơ đồ' } },
    ], async v => {
      const data = { action: f ? 'update_floor' : 'create_floor', building: slug, id: f?.id, level: v.level, name: v.name, status: v.status };
      if (v.clear_plan === '1') {
        data.clear_plan = true;
      } else if (v.plan_file) {
        if (v.plan_file.size > 2 * 1024 * 1024) throw new Error('File sơ đồ lớn hơn 2 MB');
        data.floor_plan_svg = await v.plan_file.text();
      } else if (v.floor_plan_url && v.floor_plan_url !== f?.plan_src) {
        const r = window.DriveLink.toDisplayUrl(v.floor_plan_url);
        if (!r.ok) throw new Error(r.error);
        data.floor_plan_url = r.url;
      }
      await call('api/admin/floors.php', data, 'Đã lưu tầng');
      await loadFloors();
    });
  }

  // Ghim phòng lên sơ đồ: chọn phòng -> bấm vào vị trí trên ảnh. Vị trí lưu theo % nên đúng ở mọi kích thước.
  function pinEditor(floor) {
    const rooms = floor.rooms.map(r => ({ ...r }));
    openModal(`Ghim phòng lên sơ đồ: ${floor.name}`, [], async () => {});
    $('modalSave').textContent = 'Xong';
    $('modalForm').innerHTML = `<div class="field-full pin-editor">
      <p class="field-hint">Chọn phòng, rồi bấm vào vị trí của phòng trên sơ đồ. Mỗi lần bấm được lưu ngay.</p>
      <div class="pin-toolbar">
        <select id="pinRoom" class="admin-select" aria-label="Phòng cần ghim"></select>
        <button type="button" class="btn-icon danger" id="pinClear">Bỏ ghim phòng này</button>
        <span class="field-hint" id="pinCount"></span>
      </div>
      <div class="plan-wrap pin-target" id="pinPlan"><img src="${esc(floor.plan_src)}" class="floor-svg" alt="Sơ đồ ${esc(floor.name)}" referrerpolicy="no-referrer"></div>
    </div>`;
    const select = $('pinRoom'), wrap = $('pinPlan'), img = wrap.querySelector('img');
    const render = () => {
      const keep = select.value;
      select.innerHTML = rooms.map(r => `<option value="${r.id}">${r.plan_x != null ? '✓ ' : ''}${esc(r.code)}${r.name ? ' - ' + esc(r.name) : ''}</option>`).join('');
      if (keep) select.value = keep;
      wrap.querySelectorAll('.plan-pin').forEach(p => p.remove());
      rooms.filter(r => r.plan_x != null).forEach(r => {
        const pin = document.createElement('span');
        pin.className = `plan-pin${String(r.id) === select.value ? ' active' : ''}`;
        pin.style.left = `${r.plan_x}%`; pin.style.top = `${r.plan_y}%`;
        pin.textContent = r.code;
        wrap.appendChild(pin);
      });
      $('pinCount').textContent = `Đã ghim ${rooms.filter(r => r.plan_x != null).length}/${rooms.length} phòng`;
    };
    const save = async (room, x, y) => {
      await call('api/admin/floors.php', { action: 'set_room_pin', id: room.id, plan_x: x, plan_y: y });
      room.plan_x = x; room.plan_y = y;
    };
    img.addEventListener('click', async e => {
      const room = rooms.find(r => String(r.id) === select.value);
      if (!room) return;
      const rect = img.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return; // ảnh chưa hiển thị xong
      const pct = (v, size) => Math.min(100, Math.max(0, Math.round((v / size) * 1000) / 10));
      const x = pct(e.clientX - rect.left, rect.width);
      const y = pct(e.clientY - rect.top, rect.height);
      await save(room, x, y);
      const next = rooms.find(r => r.plan_x == null); // tự chuyển sang phòng chưa ghim tiếp theo
      if (next) select.value = String(next.id);
      render();
    });
    $('pinClear').addEventListener('click', async () => {
      const room = rooms.find(r => String(r.id) === select.value);
      if (room && room.plan_x != null) { await save(room, null, null); render(); }
    });
    select.addEventListener('change', render);
    img.addEventListener('error', () => { wrap.innerHTML = '<p class="edit-modal-error">Không tải được ảnh sơ đồ (kiểm tra quyền chia sẻ trên Google Drive).</p>'; });
    if (!rooms.length) { wrap.insertAdjacentHTML('beforebegin', '<p class="field-hint">Tầng này chưa có phòng - hãy thêm phòng trước.</p>'); }
    const firstUnpinned = rooms.find(r => r.plan_x == null) || rooms[0];
    render();
    if (firstUnpinned) { select.value = String(firstUnpinned.id); render(); }
    modalSubmit = async () => { await loadFloors(); };
  }
  function roomForm(floorId, r) {
    openModal(r ? `Sửa phòng ${r.code}` : 'Thêm phòng', [
      { name: 'code', label: 'Mã phòng', value: r?.code || '', required: true, placeholder: 'vd: A304' },
      { name: 'name', label: 'Tên phòng', value: r?.name || '' },
      { name: 'room_type', label: 'Loại', type: 'select', value: r?.room_type || 'classroom', options: ROOM_TYPES },
      { name: 'capacity', label: 'Sức chứa', type: 'number', value: r?.capacity ?? '' },
      { name: 'floor_id', label: 'Tầng', type: 'select', value: floorId, options: Object.fromEntries(floorData.floors.map(f => [f.id, f.name])) },
      { name: 'status', label: 'Trạng thái', type: 'select', value: r?.status || 'active', options: { active: 'Hoạt động', maintenance: 'Bảo trì', closed: 'Đóng cửa' } },
      { name: 'department', label: 'Đơn vị quản lý', value: r?.department || '', full: true },
      { name: 'description', label: 'Ghi chú', type: 'textarea', value: r?.description || '' },
    ], async v => {
      await call('api/admin/floors.php', { action: r ? 'update_room' : 'create_room', id: r?.id, ...v }, 'Đã lưu phòng');
      await loadFloors();
    });
  }
  $('addFloorBtn').addEventListener('click', () => {
    const place = places.find(p => p.id === $('floorBuildingSelect').value);
    if (!place?.is_building) return notify('Hãy đánh dấu địa điểm là tòa nhà trước', true);
    floorForm(null);
  });
  $('floorsContainer').addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t || !floorData) return;
    const floorOf = id => floorData.floors.find(f => f.id === Number(id));
    if (t.dataset.floorEdit) floorForm(floorOf(t.dataset.floorEdit));
    if (t.dataset.floorPins) pinEditor(floorOf(t.dataset.floorPins));
    if (t.dataset.roomAdd) roomForm(Number(t.dataset.roomAdd), null);
    if (t.dataset.roomEdit) roomForm(Number(t.dataset.floor), floorOf(t.dataset.floor).rooms.find(r => r.id === Number(t.dataset.roomEdit)));
    if (t.dataset.floorDelete && confirm('Xoá tầng này và TOÀN BỘ phòng trong tầng?')) {
      await call('api/admin/floors.php', { action: 'delete_floor', id: Number(t.dataset.floorDelete) }, 'Đã xoá tầng'); await loadFloors();
    }
    if (t.dataset.roomDelete && confirm('Xoá phòng này?')) {
      await call('api/admin/floors.php', { action: 'delete_room', id: Number(t.dataset.roomDelete) }, 'Đã xoá phòng'); await loadFloors();
    }
  });

  // ---------- Đồ thị đường ----------
  let roadMap = null, edgeLayer = null, drawing = false, drawStart = null, drawMarker = null;
  const edgeStyle = e => !e.active ? { color: '#94a3b8', weight: 4, dashArray: '4 6', opacity: .9 }
    : e.type === 'steps' ? { color: '#f97316', weight: 5, opacity: .95 }
    : { color: '#2563eb', weight: 4, opacity: .85 };
  loaders.roads = async () => {
    roadMap = VM.createBaseMap('roadMap', { minZoom: 16, preferCanvas: true });
    VM.addRealBasemap(roadMap);
    roadMap.fitBounds(VM.CORE_BOUNDS);
    edgeLayer = L.layerGroup().addTo(roadMap);
    roadMap.on('click', onRoadMapClick);
    await loadEdges();
  };
  async function loadEdges() {
    const { results } = await apiFetch('api/admin/road-edges.php');
    edgeLayer.clearLayers();
    const renderer = L.canvas({ tolerance: 6 });
    results.forEach(e => {
      const line = L.polyline([e.a, e.b], { ...edgeStyle(e), renderer }).addTo(edgeLayer);
      line.on('click', ev => {
        L.DomEvent.stopPropagation(ev);
        if (drawing) return onRoadMapClick(ev);
        const html = `<div class="edge-popup"><strong>Đoạn #${e.id}</strong> · ${esc(EDGE_TYPES[e.type] || e.type)} · ${e.active ? 'đang dùng' : 'đã tắt'}
          <label>Loại <select data-edge-type>${Object.entries(EDGE_TYPES).map(([v, t]) => `<option value="${v}" ${v === e.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <div class="action-btns"><button type="button" class="btn-icon" data-edge-toggle>${e.active ? 'Tắt' : 'Bật'}</button><button type="button" class="btn-icon danger" data-edge-delete>Xoá</button></div></div>`;
        const popup = L.popup().setLatLng(ev.latlng).setContent(html).openOn(roadMap);
        const el = popup.getElement();
        el.querySelector('[data-edge-type]').addEventListener('change', async s => { await call('api/admin/road-edges.php', { action: 'update', id: e.id, type: s.target.value }, 'Đã đổi loại đường'); roadMap.closePopup(); loadEdges(); });
        el.querySelector('[data-edge-toggle]').addEventListener('click', async () => { await call('api/admin/road-edges.php', { action: 'toggle', id: e.id, active: !e.active }, e.active ? 'Đã tắt đoạn đường' : 'Đã bật đoạn đường'); roadMap.closePopup(); loadEdges(); });
        el.querySelector('[data-edge-delete]').addEventListener('click', async () => { if (!confirm('Xoá hẳn đoạn đường này?')) return; await call('api/admin/road-edges.php', { action: 'delete', id: e.id }, 'Đã xoá đoạn đường'); roadMap.closePopup(); loadEdges(); });
      });
    });
  }
  async function onRoadMapClick(e) {
    if (!drawing) return;
    if (!drawStart) {
      drawStart = e.latlng;
      drawMarker = L.circleMarker(drawStart, { radius: 6, color: '#D31145', fillOpacity: 1 }).addTo(roadMap);
      notify('Đã chọn điểm đầu, bấm điểm cuối của lối đi');
      return;
    }
    const a = drawStart, b = e.latlng;
    drawStart = null;
    if (drawMarker) { drawMarker.remove(); drawMarker = null; }
    try {
      const res = await call('api/admin/road-edges.php', { action: 'create', type: $('newEdgeType').value, a: { lat: a.lat, lng: a.lng }, b: { lat: b.lat, lng: b.lng } });
      notify(`Đã thêm lối đi ${res.length_m} m`);
      loadEdges();
    } catch (_) { /* đã báo lỗi */ }
  }
  $('drawEdgeBtn').addEventListener('click', () => {
    drawing = !drawing;
    drawStart = null;
    if (drawMarker) { drawMarker.remove(); drawMarker = null; }
    $('drawEdgeBtn').setAttribute('aria-pressed', String(drawing));
    $('drawEdgeBtn').textContent = drawing ? 'Đang vẽ (bấm để dừng)' : 'Vẽ lối đi mới';
    $('roadMap').classList.toggle('drawing', drawing);
  });

  // ---------- Danh mục ----------
  let categoryRows = [];
  async function loadCategories() {
    categoryRows = (await apiFetch('api/admin/categories.php')).results;
    $('categoriesTableBody').innerHTML = categoryRows.map(c => `<tr><td><code>${esc(c.code)}</code></td><td>${esc(c.name)}</td>
      <td><span class="color-dot" style="background:${esc(c.color || '#ccc')}"></span>${esc(c.color)}</td><td>${c.sort_order}</td><td>${c.places}</td>
      <td><button type="button" class="btn-icon" data-cat-edit="${esc(c.code)}">Sửa</button></td></tr>`).join('');
  }
  loaders.categories = loadCategories;
  function categoryForm(c) {
    openModal(c ? `Sửa danh mục ${c.name}` : 'Thêm danh mục', [
      { name: 'code', label: 'Mã (không dấu)', value: c?.code || '', required: true, readonly: Boolean(c) },
      { name: 'name', label: 'Tên', value: c?.name || '', required: true },
      { name: 'color', label: 'Màu', type: 'color', value: c?.color || '#00458c' },
      { name: 'sort_order', label: 'Thứ tự', type: 'number', value: c?.sort_order ?? 0 },
    ], async v => { await call('api/admin/categories.php', { action: c ? 'update' : 'create', ...v }, 'Đã lưu danh mục'); await loadCategories(); loaded.delete('places'); });
  }
  $('addCategoryBtn').addEventListener('click', () => categoryForm(null));
  $('categoriesTableBody').addEventListener('click', e => { const b = e.target.closest('[data-cat-edit]'); if (b) categoryForm(categoryRows.find(c => c.code === b.dataset.catEdit)); });

  // ---------- Tài khoản sinh viên ----------
  let userRows = [];
  async function loadUsers() {
    userRows = (await apiFetch('api/admin/users.php')).results;
    $('usersTableBody').innerHTML = userRows.length ? userRows.map(u => `<tr><td><strong>${esc(u.student_code)}</strong></td><td>${esc(u.email)}</td>
      <td>${u.favorites} / ${u.routes}</td><td>${fmtDate(u.last_login_at)}</td>
      <td><span class="badge-status status-${u.status === 'active' ? 'active' : 'maintenance'}">${esc(STATUS[u.status] || u.status)}</span></td>
      <td class="action-btns"><button type="button" class="btn-icon" data-user="${u.id}" data-act="detail">Chi tiết sinh viên</button>
      <button type="button" class="btn-icon danger" data-user="${u.id}" data-act="delete">Xoá</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="empty-cell">Chưa có sinh viên nào đăng ký</td></tr>';
  }
  loaders.users = loadUsers;
  $('addUserBtn').addEventListener('click', () => {
    openModal('Thêm tài khoản sinh viên', [
      { name: 'student_code', label: 'MSSV', required: true, placeholder: 'vd: 52300001' },
      { name: 'full_name', label: 'Họ tên', required: true },
      { name: 'email', label: 'Email (không bắt buộc)', type: 'email' },
      { name: 'password', label: 'Mật khẩu (≥ 8 ký tự)', type: 'password', required: true },
    ], async v => {
      await call('api/admin/users.php', { action: 'create', ...v }, 'Đã tạo tài khoản');
      loadUsers();
    });
  });
  $('usersTableBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-user]');
    if (!b) return;
    const id = Number(b.dataset.user), act = b.dataset.act;
    const u = userRows.find(x => x.id === id);
    if (act === 'detail') {
      return openModal(`Chi tiết sinh viên ${u.student_code}`, [
        { name: 'full_name', label: 'Họ tên', value: u.full_name, readonly: true },
        { name: 'email', label: 'Email', value: u.email || '—', readonly: true },
        { name: 'stats', label: 'Yêu thích / Lộ trình', value: `${u.favorites} / ${u.routes}`, readonly: true },
        { name: 'last_login', label: 'Đăng nhập gần nhất', value: fmtDate(u.last_login_at), readonly: true },
        { name: 'status', label: 'Trạng thái', type: 'select', options: { active: 'Hoạt động', locked: 'Đã khoá' }, value: u.status === 'active' ? 'active' : 'locked' },
      ], async v => {
        if (v.status !== (u.status === 'active' ? 'active' : 'locked')) {
          await call('api/admin/users.php', { action: v.status === 'active' ? 'unlock' : 'lock', id }, null);
        }
        notify('Đã cập nhật tài khoản');
        loadUsers();
      });
    }
    if (act === 'delete' && !confirm(`Xoá tài khoản ${u.student_code}? Không thể hoàn tác.`)) return;
    if (act === 'delete') {
      await call('api/admin/users.php', { action: act, id }, 'Đã xoá tài khoản');
      loadUsers();
    }
  });

  // ---------- Nhật ký ----------
  const summary = o => o ? Object.entries(o).map(([k, v]) => `${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('<br>') : '';
  loaders.audit = async () => {
    const { results } = await apiFetch('api/admin/audit.php?limit=200');
    $('auditTableBody').innerHTML = results.map(a => `<tr><td>${fmtDate(a.created_at)}</td><td>${esc(a.username || '—')}</td><td>${esc(a.action)}</td>
      <td>${esc(a.entity)} #${a.entity_id ?? ''}</td><td class="audit-cell">${summary(a.old_data)}</td><td class="audit-cell">${summary(a.new_data)}</td></tr>`).join('');
  };

  // ---------- Tài khoản admin ----------
  apiFetch('api/admin/account.php').then(acc => {
    $('accountUsername').textContent = acc.username;
    $('adminName').textContent = acc.full_name || acc.username;
  }).catch(() => {});
  $('accountForm').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('accountStatus');
    try {
      await apiFetch('api/admin/account.php', { method: 'POST', data: { current_password: $('accCurrent').value, new_password: $('accNew').value } });
      status.textContent = 'Đã đổi mật khẩu.'; status.dataset.state = 'ok';
      e.target.reset();
    } catch (err) { status.textContent = err.message; status.dataset.state = 'error'; }
  });

  showView(location.hash.slice(1) || 'dashboard');
});
