<?php
require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/config/db.php';
$isAdminSession = (bool) current_admin_id();

// Nơi được chọn từ campus-map.php (nút "Xem thông tin chi tiết"). Không có ?slug= hoặc không tìm
// thấy -> dùng dữ liệu mẫu "Tòa A" như trước đây, có ghi rõ là ví dụ minh hoạ.
$BUILDING_CATEGORIES = ['Tòa nhà', 'Tòa nhà · Thư viện', 'Ký túc xá', 'Trường trực thuộc'];
$slug = trim($_GET['slug'] ?? '');
$place = null;
if ($slug !== '') {
    $stmt = db()->prepare('SELECT slug, name, category_label, lat, lng FROM places WHERE slug = :slug AND is_active = 1 LIMIT 1');
    $stmt->execute([':slug' => $slug]);
    $place = $stmt->fetch() ?: null;
}
$isSample = !$place;
$displayName = $place['name'] ?? 'Tòa A';
$displayCategory = $place['category_label'] ?? 'Tòa nhà';
$showFloorDemo = in_array($displayCategory, $BUILDING_CATEGORIES, true);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TDTU | Chi tiết <?php echo htmlspecialchars($displayName); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    
    <link rel="stylesheet" href="css/building-details.css?v=<?php echo @filemtime(__DIR__.'/css/building-details.css') ?: time(); ?>">
</head>
<body>

    <header class="app-header">
        <a href="home.php" class="logo">
            <img src="image/logo.svg" alt="TDTU Logo" height="24" style="margin-right: 8px;">
            BẢN ĐỒ KHUÔN VIÊN TDTU
        </a>
        <nav class="nav-links">
            <a href="home.php">Trang chủ</a>
            <a href="campus-map.php" class="active">Bản đồ</a>
            <a href="navigation.php">Tìm đường</a>
        </nav>
        <div class="user-menu">
            <?php if ($isAdminSession): ?>
                <a href="admin.php" title="Về trang quản trị"><div class="avatar admin-avatar">AD</div></a>
            <?php else: ?>
                <div class="avatar">SV</div>
            <?php endif; ?>
        </div>
    </header>

    <div class="building-layout">
        <!-- Sidebar -->
        <div class="building-sidebar">
            <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="<?php echo htmlspecialchars($displayName); ?>" class="building-image">

            <div class="building-info">
                <h2><?php echo htmlspecialchars($displayName); ?> <span class="badge"><?php echo htmlspecialchars($displayCategory); ?></span></h2>
                <?php if ($isSample): ?>
                    <p class="text-light">Chưa chọn địa điểm nào từ bản đồ - đây là dữ liệu ví dụ minh hoạ bố cục trang.</p>
                <?php elseif ($place): ?>
                    <p class="text-light">Toạ độ: <?php echo htmlspecialchars(number_format((float) $place['lat'], 6) . ', ' . number_format((float) $place['lng'], 6)); ?></p>
                <?php endif; ?>

                <?php if ($showFloorDemo): ?>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-value">05</div>
                        <div class="info-label">Số tầng (mẫu)</div>
                    </div>
                    <div class="info-item">
                        <div class="info-value">42</div>
                        <div class="info-label">Phòng học (mẫu)</div>
                    </div>
                </div>
                <?php endif; ?>
            </div>

            <?php if ($showFloorDemo): ?>
            <div class="floor-selector">
                <h3 class="text-primary">Sơ đồ các tầng</h3>
                <div class="floor-list">
                    <button class="floor-btn active">
                        Tầng 3
                        <span class="floor-badge">12 Phòng</span>
                    </button>
                    <button class="floor-btn">
                        Tầng 2
                        <span class="floor-badge">10 Phòng</span>
                    </button>
                    <button class="floor-btn">
                        Tầng 1
                        <span class="floor-badge">Phòng Hành chính</span>
                    </button>
                    <button class="floor-btn">
                        Tầng Trệt (G)
                        <span class="floor-badge">Sảnh, WC</span>
                    </button>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <?php if ($showFloorDemo): ?>
        <!-- Floor Plan Area (mẫu minh hoạ - chưa có dữ liệu sơ đồ tầng thật cho từng phòng) -->
        <div class="floor-map-container">
            <div class="floor-map-header">
                <h3>Sơ đồ Tầng 3 - <?php echo htmlspecialchars($displayName); ?> (mẫu)</h3>
                
                <!-- Search within floor -->
                <div class="search-container" style="width: 250px;">
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" class="search-input" style="padding: 0.5rem 1rem 0.5rem 2.5rem; border-radius: 20px;" placeholder="Tìm phòng (vd: A304)">
                </div>

                <div class="map-legend">
                    <div class="legend-item"><div class="legend-color" style="background: #F1F5F9; border: 1px solid #CBD5E1;"></div> Phòng học</div>
                    <div class="legend-item"><div class="legend-color" style="background: #3B82F6;"></div> Thang bộ</div>
                    <div class="legend-item"><div class="legend-color" style="background: #8B5CF6;"></div> Thang máy</div>
                    <div class="legend-item"><div class="legend-color" style="background: #10B981;"></div> WC</div>
                </div>
            </div>

            <div class="floor-plan-area">
                <div class="floor-plan-mockup">
                    <!-- Corridor -->
                    <div class="corridor">Hành lang chính</div>

                    <!-- Top row rooms -->
                    <div class="room" style="top: 50px; left: 50px; width: 120px; height: 150px;">A301</div>
                    <div class="room" style="top: 50px; left: 190px; width: 120px; height: 150px;">A302</div>
                    <div class="room" style="top: 50px; left: 330px; width: 120px; height: 150px;">A303</div>
                    <div class="room highlight" style="top: 50px; left: 470px; width: 120px; height: 150px;" title="Phòng A304 - Đang được tìm kiếm">A304</div>
                    
                    <!-- Top Facilities -->
                    <div class="facility stairs" style="top: 50px; left: 610px; width: 60px; height: 80px;">Thang bộ B</div>
                    <div class="facility elevator" style="top: 140px; left: 610px; width: 60px; height: 60px;">Thang máy</div>
                    <div class="facility wc" style="top: 50px; left: 690px; width: 60px; height: 150px;">WC Nam</div>

                    <!-- Bottom row rooms -->
                    <div class="room" style="top: 300px; left: 50px; width: 160px; height: 150px;">A305</div>
                    <div class="room" style="top: 300px; left: 230px; width: 160px; height: 150px;">A306</div>
                    <div class="room" style="top: 300px; left: 410px; width: 160px; height: 150px;">A307</div>
                    
                    <!-- Bottom Facilities -->
                    <div class="facility stairs" style="top: 300px; left: 590px; width: 80px; height: 150px;">Thang bộ A</div>
                    <div class="facility wc" style="top: 300px; left: 690px; width: 60px; height: 150px;">WC Nữ</div>
                </div>
            </div>
        </div>
        <?php else: ?>
        <div class="floor-map-container" style="display:flex; align-items:center; justify-content:center; padding:3rem; color:var(--text-light,#64748b); text-align:center;">
            <p>Chưa có dữ liệu sơ đồ tầng/phòng cho "<?php echo htmlspecialchars($displayName); ?>" (danh mục "<?php echo htmlspecialchars($displayCategory); ?>" không phải tòa nhà có tầng/phòng).</p>
        </div>
        <?php endif; ?>
    </div>

    <script src="js/main.js?v=<?php echo @filemtime(__DIR__.'/js/main.js') ?: time(); ?>"></script>
    
<script src="js/building-details.js?v=<?php echo @filemtime(__DIR__.'/js/building-details.js') ?: time(); ?>"></script>
</body>
</html>
