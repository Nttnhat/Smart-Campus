<?php
require_once __DIR__ . '/config/auth.php';
require_admin_page(); // chưa đăng nhập -> login.php?role=admin
$logoutToken = urlencode(csrf_token());
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php echo csrf_meta(); ?>
    <title>TDTU | Quản trị Hệ thống</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    <link rel="stylesheet" href="css/admin.css?v=<?php echo @filemtime(__DIR__.'/css/admin.css') ?: time(); ?>">
</head>
<body>
    <header class="app-header">
        <a href="home.php" class="logo">
            <img src="image/logo.svg" alt="TDTU Logo" height="24" style="margin-right: 8px;">
            <span class="logo-text">BẢN ĐỒ KHUÔN VIÊN TDTU</span>
        </a>
        <div class="user-menu">
            <span class="user-menu-name" id="adminName">Quản trị</span>
            <div class="avatar admin-avatar">AD</div>
            <a href="api/logout.php?t=<?php echo $logoutToken; ?>" class="user-menu-logout">Đăng xuất</a>
        </div>
    </header>

    <div class="admin-layout">
        <aside class="admin-sidebar">
            <nav aria-label="Mục quản trị">
                <ul class="admin-menu">
                    <li><a href="#dashboard" data-view="dashboard" class="active">Tổng quan</a></li>
                    <li><a href="#places" data-view="places">Địa điểm</a></li>
                    <li><a href="#entrances" data-view="entrances">Lối vào</a></li>
                    <li><a href="#floors" data-view="floors">Tầng &amp; Phòng</a></li>
                    <li><a href="#roads" data-view="roads">Đường đi</a></li>
                    <li><a href="#categories" data-view="categories">Danh mục</a></li>
                    <li><a href="#users" data-view="users">Tài khoản người dùng</a></li>
                    <li><a href="#audit" data-view="audit">Nhật ký thay đổi</a></li>
                    <li><a href="#account" data-view="account">Tài khoản của tôi</a></li>
                    <li><a href="home.php" class="admin-menu-home">← Về trang chủ</a></li>
                </ul>
            </nav>
        </aside>

        <main class="admin-content">
            <p id="adminNotice" class="admin-notice" role="status" hidden></p>

            <!-- Tổng quan -->
            <section id="view-dashboard" class="admin-view" aria-labelledby="h-dashboard">
                <h1 id="h-dashboard" class="admin-title">Tổng quan hệ thống</h1>
                <div class="stats-grid" id="statsGrid"></div>
                <div class="admin-grid-2">
                    <div class="table-container">
                        <h3 class="panel-title">Lượt tìm kiếm &amp; dẫn đường 14 ngày</h3>
                        <div class="bar-chart" id="dailyChart" role="img" aria-label="Biểu đồ lượt dùng theo ngày"></div>
                        <div class="chart-legend"><span class="lg-search">Tìm kiếm</span><span class="lg-route">Dẫn đường</span></div>
                    </div>
                    <div class="table-container">
                        <h3 class="panel-title">Điểm đến được tìm đường nhiều nhất (30 ngày)</h3>
                        <ol class="rank-list" id="topDestinations"></ol>
                    </div>
                    <div class="table-container">
                        <h3 class="panel-title">Từ khoá tìm nhiều nhất</h3>
                        <ol class="rank-list" id="topKeywords"></ol>
                    </div>
                    <div class="table-container">
                        <h3 class="panel-title">Tìm nhưng không có kết quả</h3>
                        <p class="panel-hint">Gợi ý: thêm địa điểm hoặc bí danh cho các từ này.</p>
                        <ol class="rank-list" id="missedKeywords"></ol>
                    </div>
                </div>
            </section>

            <!-- Địa điểm -->
            <section id="view-places" class="admin-view" aria-labelledby="h-places" hidden>
                <div class="view-header">
                    <h1 id="h-places" class="admin-title">Địa điểm &amp; tiện ích</h1>
                    <button type="button" class="btn btn-secondary" id="addPlaceBtn">+ Thêm địa điểm</button>
                </div>
                <div class="table-container">
                    <div class="table-header">
                        <input type="search" id="placeSearchInput" class="search-input admin-search" placeholder="Tìm theo tên, mã hoặc danh mục…" aria-label="Lọc địa điểm">
                        <label class="inline-check"><input type="checkbox" id="showHiddenPlaces"> Hiện cả địa điểm đã ẩn</label>
                    </div>
                    <div class="table-scroll">
                        <table>
                            <thead><tr><th>Tên</th><th>Nhãn / danh mục</th><th>Lối vào</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
                            <tbody id="placesTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- Lối vào -->
            <section id="view-entrances" class="admin-view" aria-labelledby="h-entrances" hidden>
                <h1 id="h-entrances" class="admin-title">Lối vào tòa nhà</h1>
                <p class="panel-hint">Chọn địa điểm → bấm lên bản đồ để thêm lối vào → kéo chấm để chỉnh vị trí → bấm <strong>Lưu lại</strong> để ghi vào database. Router sẽ chọn lối vào cho tuyến ngắn nhất.</p>
                <div class="table-header">
                    <select id="entrancePlaceSelect" class="admin-select" aria-label="Chọn địa điểm"></select>
                    <select id="entranceTypeSelect" class="admin-select" aria-label="Loại lối vào khi thêm mới">
                        <option value="main">Cửa chính</option><option value="side">Cửa phụ</option><option value="gate">Cổng</option>
                        <option value="vehicle_in">Lối xe vào</option><option value="vehicle_out">Lối xe ra</option>
                    </select>
                    <button type="button" class="btn btn-secondary" id="entranceSaveBtn" disabled>Lưu lại</button>
                </div>
                <div id="entranceMap" class="admin-map"></div>
                <ul class="profile-list" id="entranceList"></ul>
            </section>

            <!-- Tầng & phòng -->
            <section id="view-floors" class="admin-view" aria-labelledby="h-floors" hidden>
                <h1 id="h-floors" class="admin-title">Tầng &amp; phòng</h1>
                <div class="table-header">
                    <select id="floorBuildingSelect" class="admin-select" aria-label="Chọn tòa nhà"></select>
                    <button type="button" class="btn btn-outline" id="addFloorBtn">+ Thêm tầng</button>
                </div>
                <div id="floorsContainer"></div>
            </section>

            <!-- Đường đi -->
            <section id="view-roads" class="admin-view" aria-labelledby="h-roads" hidden>
                <h1 id="h-roads" class="admin-title">Đồ thị đường đi bộ</h1>
                <p class="panel-hint">Bấm vào một đoạn để bật/tắt (vd đang sửa chữa), đổi loại đường hoặc xoá. Bật "Vẽ lối đi mới" rồi bấm 2 điểm để thêm lối đi còn thiếu (vd sảnh nối A–B, lối vào VFIS).</p>
                <div class="table-header">
                    <button type="button" class="btn btn-outline" id="drawEdgeBtn" aria-pressed="false">Vẽ lối đi mới</button>
                    <select id="newEdgeType" class="admin-select" aria-label="Loại lối đi mới">
                        <option value="footway">Lối đi bộ</option><option value="crossing">Vạch qua đường</option>
                        <option value="steps">Bậc thang</option><option value="service">Đường nội bộ (xe)</option>
                    </select>
                    <span class="map-legend-inline"><i class="lg-active"></i>Đang dùng <i class="lg-steps"></i>Bậc thang <i class="lg-off"></i>Đã tắt</span>
                </div>
                <div id="roadMap" class="admin-map admin-map-tall"></div>
            </section>

            <!-- Danh mục -->
            <section id="view-categories" class="admin-view" aria-labelledby="h-categories" hidden>
                <div class="view-header">
                    <h1 id="h-categories" class="admin-title">Danh mục địa điểm</h1>
                    <button type="button" class="btn btn-secondary" id="addCategoryBtn">+ Thêm danh mục</button>
                </div>
                <div class="table-container table-scroll">
                    <table>
                        <thead><tr><th>Mã</th><th>Tên</th><th>Màu</th><th>Thứ tự</th><th>Số địa điểm</th><th></th></tr></thead>
                        <tbody id="categoriesTableBody"></tbody>
                    </table>
                </div>
            </section>

            <!-- Tài khoản sinh viên -->
            <section id="view-users" class="admin-view" aria-labelledby="h-users" hidden>
                <div class="view-header">
                    <h1 id="h-users" class="admin-title">Tài khoản người dùng</h1>
                    <button type="button" class="btn btn-secondary" id="addUserBtn">+ Thêm tài khoản</button>
                </div>
                <div class="table-container table-scroll">
                    <table>
                        <thead><tr><th>MSSV</th><th>Email</th><th>Yêu thích / Lộ trình</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th></th></tr></thead>
                        <tbody id="usersTableBody"></tbody>
                    </table>
                </div>
            </section>

            <!-- Nhật ký -->
            <section id="view-audit" class="admin-view" aria-labelledby="h-audit" hidden>
                <h1 id="h-audit" class="admin-title">Nhật ký thay đổi</h1>
                <div class="table-container table-scroll">
                    <table>
                        <thead><tr><th>Thời gian</th><th>Người sửa</th><th>Hành động</th><th>Đối tượng</th><th>Trước</th><th>Sau</th></tr></thead>
                        <tbody id="auditTableBody"></tbody>
                    </table>
                </div>
            </section>

            <!-- Tài khoản admin -->
            <section id="view-account" class="admin-view" aria-labelledby="h-account" hidden>
                <h1 id="h-account" class="admin-title">Tài khoản của tôi</h1>
                <form id="accountForm" class="table-container admin-form narrow" novalidate>
                    <p>Tên đăng nhập: <strong id="accountUsername">—</strong></p>
                    <label>Mật khẩu hiện tại<input type="password" id="accCurrent" autocomplete="current-password" required></label>
                    <label>Mật khẩu mới (≥ 8 ký tự)<input type="password" id="accNew" autocomplete="new-password" minlength="8" required></label>
                    <p class="form-status" id="accountStatus" role="status"></p>
                    <button type="submit" class="btn btn-secondary">Đổi mật khẩu</button>
                </form>
            </section>
        </main>
    </div>

    <!-- Hộp thoại dùng chung (form thêm/sửa) -->
    <div id="modalOverlay" class="edit-modal-overlay" hidden>
        <div class="edit-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <h3 id="modalTitle">Sửa</h3>
            <form id="modalForm" class="admin-form" novalidate></form>
            <p class="edit-modal-error" id="modalError" role="alert" hidden></p>
            <div class="edit-modal-actions">
                <button type="button" class="btn-icon" id="modalCancel">Hủy</button>
                <button type="button" class="btn btn-secondary" id="modalSave">Lưu</button>
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script src="js/api.js?v=<?php echo @filemtime(__DIR__.'/js/api.js') ?: time(); ?>"></script>
    <script src="js/lib/walk-router.js?v=<?php echo @filemtime(__DIR__.'/js/lib/walk-router.js') ?: time(); ?>"></script>
    <script src="js/lib/entrances.js"></script>
    <script src="js/lib/drive-link.js?v=<?php echo @filemtime(__DIR__.'/js/lib/drive-link.js') ?: time(); ?>"></script>
    <script src="js/tdtu-vector-map.js?v=<?php echo @filemtime(__DIR__.'/js/tdtu-vector-map.js') ?: time(); ?>"></script>
    <script src="js/admin.js?v=<?php echo @filemtime(__DIR__.'/js/admin.js') ?: time(); ?>"></script>
</body>
</html>
