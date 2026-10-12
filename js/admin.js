// Trang admin: nối trực tiếp với OFFICIAL_PLACES đang dùng cho navigation.php/campus-map.php.
// Không có backend/database thật, nên sửa tên/danh mục được lưu đè (override) trong localStorage
// của trình duyệt này - không đồng bộ sang người dùng khác, không ghi lại vào file code.
document.addEventListener('DOMContentLoaded', async () => {
  const VM = window.TDTUVectorMap;
  await VM.loadOfficialPlaces();
  const basePlaces = (VM && VM.OFFICIAL_PLACES) || [];

  const BUILDING_CATEGORIES = new Set(['Tòa nhà', 'Tòa nhà · Thư viện', 'Ký túc xá', 'Trường trực thuộc']);
  const OVERRIDES_KEY = 'tdtu_admin_overrides';

  function loadOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); } catch (_) { return {}; }
  }
  function saveOverrides(overrides) {
    try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides)); } catch (_) { /* bỏ qua */ }
  }

  // Luôn tính lại từ base + override hiện tại, để số liệu/bảng là "động" theo đúng trạng thái mới
  // nhất sau mỗi lần sửa, không phải giá trị tính một lần lúc tải trang.
  function getEffectivePlaces() {
    const overrides = loadOverrides();
    return basePlaces.map(p => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p));
  }

  function entranceCount(id) {
    return window.Entrances ? window.Entrances.entrancesFor(id).length : 0;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function editButton(id) {
    return `<button type="button" class="btn-icon" data-edit="${escapeHtml(id)}" title="Sửa"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg></button>`;
  }

  // ---- Dashboard: thống kê + bảng Tòa nhà ----
  function renderStats() {
    const places = getEffectivePlaces();
    const buildings = places.filter(p => BUILDING_CATEGORIES.has(p.category));
    document.getElementById('statBuildings').textContent = buildings.length;
    document.getElementById('statPlaces').textContent = places.length;
    document.getElementById('statCoverage').textContent = places.filter(p => p.coverage).length;
    document.getElementById('statEntrances').textContent = buildings.filter(b => entranceCount(b.id) > 0).length;
  }

  function renderBuildingsTable(filterText = '') {
    const tbody = document.getElementById('buildingsTableBody');
    const buildings = getEffectivePlaces().filter(p => BUILDING_CATEGORIES.has(p.category));
    const q = VM.normalise(filterText);
    const rows = buildings.filter(b => !q || VM.normalise(b.name).includes(q) || b.id.includes(q));
    tbody.innerHTML = rows.length ? rows.map(b => `
      <tr>
        <td><strong>${escapeHtml(b.name)}</strong></td>
        <td>${escapeHtml(b.category)}</td>
        <td>${editButton(b.id)}</td>
      </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:var(--secondary,#64748b);padding:1.5rem;">Không tìm thấy tòa nào khớp "${escapeHtml(filterText)}"</td></tr>`;
  }

  // ---- Địa điểm & Tiện ích: toàn bộ OFFICIAL_PLACES ----
  function renderPlacesTable(filterText = '') {
    const tbody = document.getElementById('placesTableBody');
    const places = getEffectivePlaces();
    const q = VM.normalise(filterText);
    const rows = places.filter(p => !q || VM.normalise(p.name).includes(q) || VM.normalise(p.category).includes(q) || p.id.includes(q));
    tbody.innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.category)}</td>
        <td>${editButton(p.id)}</td>
      </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:var(--secondary,#64748b);padding:1.5rem;">Không tìm thấy địa điểm nào khớp "${escapeHtml(filterText)}"</td></tr>`;
  }

  function renderAll() {
    renderStats();
    renderBuildingsTable(document.getElementById('buildingSearchInput').value);
    renderPlacesTable(document.getElementById('placeSearchInput').value);
  }

  renderAll();

  document.getElementById('buildingSearchInput').addEventListener('input', e => renderBuildingsTable(e.target.value));
  document.getElementById('placeSearchInput').addEventListener('input', e => renderPlacesTable(e.target.value));

  // ---- Modal sửa tên/danh mục, lưu override vào localStorage ----
  const overlay = document.getElementById('editModalOverlay');
  const nameInput = document.getElementById('editName');
  const categoryInput = document.getElementById('editCategory');
  let editingId = null;

  function openEdit(id) {
    const place = getEffectivePlaces().find(p => p.id === id);
    if (!place) return;
    editingId = id;
    nameInput.value = place.name;
    categoryInput.value = place.category;
    overlay.hidden = false;
    nameInput.focus();
  }
  function closeEdit() {
    overlay.hidden = true;
    editingId = null;
  }

  document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit]');
    if (btn) openEdit(btn.dataset.edit);
  });
  document.getElementById('editCancelBtn').addEventListener('click', closeEdit);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeEdit(); });

  document.getElementById('editSaveBtn').addEventListener('click', () => {
    if (!editingId) return;
    const name = nameInput.value.trim();
    const category = categoryInput.value.trim();
    if (!name || !category) return;
    const overrides = loadOverrides();
    overrides[editingId] = { ...(overrides[editingId] || {}), name, category };
    saveOverrides(overrides);
    closeEdit();
    renderAll();
  });

  // ---- Chuyển view qua sidebar; mục chưa có dữ liệu thật thì báo rõ thay vì giả vờ hoạt động ----
  const notice = document.getElementById('adminNotice');
  let noticeTimer = null;
  function showNotice(text) {
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
  }

  document.querySelectorAll('.admin-menu a[data-view]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view === 'unavailable') {
        showNotice('Mục này chưa có dữ liệu thật (không có backend/database) - chưa triển khai.');
        return;
      }
      document.querySelectorAll('.admin-menu a[data-view]').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(section => { section.hidden = true; });
      document.getElementById(`view-${view}`).hidden = false;
    });
  });
});
