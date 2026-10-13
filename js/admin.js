// Trang admin: nối trực tiếp với OFFICIAL_PLACES đang dùng cho navigation.php/campus-map.php
// (nạp từ database qua api/places.php). Sửa tên/danh mục gọi api/admin/update_place.php - ghi
// thật vào bảng `places`, cần đăng nhập admin (session), có audit_logs. Sau khi lưu, cập nhật
// trực tiếp vào mảng VM.OFFICIAL_PLACES (cùng reference đang dùng cho search/nhãn) để không phải
// tải lại trang.
document.addEventListener('DOMContentLoaded', async () => {
  const VM = window.TDTUVectorMap;
  await VM.loadOfficialPlaces();

  const BUILDING_CATEGORIES = new Set(['Tòa nhà', 'Tòa nhà · Thư viện', 'Ký túc xá', 'Trường trực thuộc']);

  function getEffectivePlaces() {
    return VM.OFFICIAL_PLACES;
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

  const saveBtn = document.getElementById('editSaveBtn');
  const editError = document.createElement('p');
  editError.className = 'edit-modal-error';
  editError.hidden = true;
  saveBtn.closest('.edit-modal').insertBefore(editError, saveBtn.closest('.edit-modal-actions'));

  saveBtn.addEventListener('click', async () => {
    if (!editingId) return;
    const name = nameInput.value.trim();
    const category = categoryInput.value.trim();
    if (!name || !category) return;
    editError.hidden = true;
    saveBtn.disabled = true;
    try {
      const body = new URLSearchParams({ slug: editingId, name, category });
      const res = await fetch('api/admin/update_place.php', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
      const place = VM.OFFICIAL_PLACES.find(p => p.id === editingId);
      if (place) { place.name = name; place.category = category; }
      closeEdit();
      renderAll();
    } catch (err) {
      editError.textContent = 'Lưu thất bại: ' + err.message;
      editError.hidden = false;
    } finally {
      saveBtn.disabled = false;
    }
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
