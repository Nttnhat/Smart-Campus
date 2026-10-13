<?php
require_once __DIR__ . '/config/auth.php';
require_admin_page(); // chưa đăng nhập -> đẩy về login.php
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TDTU | Quản trị Hệ thống</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    
    <link rel="stylesheet" href="css/admin.css">
</head>
<body>

    <header class="app-header">
        <a href="home.php" class="logo">
            <img src="image/logo.svg" alt="TDTU Logo" height="24" style="margin-right: 8px;">
            BẢN ĐỒ KHUÔN VIÊN TDTU
        </a>
        <div class="user-menu">
            <span style="font-size: 0.9rem; font-weight: 500;">Admin Panel</span>
            <div class="avatar" style="border-color: white;">AD</div>
            <a href="api/logout.php" style="color:#fff; font-size:0.85rem; margin-left:12px;">Đăng xuất</a>
        </div>
    </header>

    <div class="admin-layout">
        <aside class="admin-sidebar">
            <ul class="admin-menu">
                <li><a href="#" class="active" data-view="dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard</a></li>
                <li><a href="#" data-view="unavailable"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg> Quản lý Tầng & Phòng</a></li>
                <li><a href="#" data-view="places"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg> Địa điểm & Tiện ích</a></li>
                <li><a href="home.php" style="margin-top: 2rem; color: var(--secondary);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Về trang chủ</a></li>
            </ul>
        </aside>

        <main class="admin-content">
            <p id="adminNotice" class="admin-notice" hidden></p>

            <section id="view-dashboard" class="admin-view">
                <div class="dashboard-header">
                    <h1 style="color: var(--primary);">Tổng quan hệ thống</h1>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg></div>
                        <div class="stat-info">
                            <h3 id="statBuildings">—</h3>
                            <p>Tổng số Tòa nhà</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></div>
                        <div class="stat-info">
                            <h3 id="statPlaces">—</h3>
                            <p>Tổng số Địa điểm</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg></div>
                        <div class="stat-info">
                            <h3 id="statCoverage">—</h3>
                            <p>Đã có vùng phủ (coverage)</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg></div>
                        <div class="stat-info">
                            <h3 id="statEntrances">—</h3>
                            <p>Tòa đã có lối vào</p>
                        </div>
                    </div>
                </div>

                <div class="table-container">
                    <div class="table-header">
                        <h3 style="margin: 0; color: var(--primary);">Danh sách Tòa nhà</h3>
                        <div class="search-container" style="width: 300px;">
                            <input type="text" id="buildingSearchInput" class="search-input" placeholder="Tìm kiếm tòa nhà..." style="padding: 0.5rem 1rem 0.5rem 2.5rem;">
                            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Tên Tòa Nhà</th>
                                <th>Danh mục</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody id="buildingsTableBody"></tbody>
                    </table>
                </div>
            </section>

            <section id="view-places" class="admin-view" hidden>
                <div class="dashboard-header">
                    <h1 style="color: var(--primary);">Địa điểm & Tiện ích</h1>
                </div>
                <div class="table-container">
                    <div class="table-header">
                        <h3 style="margin: 0; color: var(--primary);">Tất cả địa điểm</h3>
                        <div class="search-container" style="width: 300px;">
                            <input type="text" id="placeSearchInput" class="search-input" placeholder="Tìm theo tên hoặc danh mục..." style="padding: 0.5rem 1rem 0.5rem 2.5rem;">
                            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Tên</th>
                                <th>Danh mục</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody id="placesTableBody"></tbody>
                    </table>
                </div>
            </section>

            <div id="editModalOverlay" class="edit-modal-overlay" hidden>
                <div class="edit-modal">
                    <h3>Sửa địa điểm</h3>
                    <label>Tên<input type="text" id="editName"></label>
                    <label>Danh mục<input type="text" id="editCategory"></label>
                    <p class="edit-modal-hint">Lưu thật vào database, mọi người dùng đều thấy thay đổi.</p>
                    <div class="edit-modal-actions">
                        <button type="button" class="btn-icon" id="editCancelBtn">Hủy</button>
                        <button type="button" class="btn btn-secondary" id="editSaveBtn">Lưu</button>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script src="js/lib/entrances.js"></script>
    <script src="js/tdtu-vector-map.js?v=<?php echo @filemtime(__DIR__.'/js/tdtu-vector-map.js') ?: time(); ?>"></script>
    <script src="js/admin.js?v=<?php echo @filemtime(__DIR__.'/js/admin.js') ?: time(); ?>"></script>
</body>
</html>
