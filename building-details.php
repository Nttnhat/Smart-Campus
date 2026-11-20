<?php
require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/media.php';

// Trang chi tiết địa điểm/tòa nhà, dữ liệu thật từ database (places, buildings, floors, rooms,
// place_entrances). ?slug=toa-a [&floor=3] [&room=A304]. Không có slug -> danh sách tòa nhà.
const ROOM_TYPES = ['classroom' => 'Phòng học', 'lab' => 'Phòng thí nghiệm', 'office' => 'Văn phòng', 'support' => 'Hỗ trợ',
    'stairs' => 'Thang bộ', 'elevator' => 'Thang máy', 'wc' => 'WC', 'corridor' => 'Hành lang', 'other' => 'Khác'];
const STATUS_LABELS = ['active' => 'Đang hoạt động', 'maintenance' => 'Đang bảo trì', 'closed' => 'Tạm đóng cửa'];

$pdo = db();
$slug = trim((string) ($_GET['slug'] ?? ''));
$place = null;
if ($slug !== '') {
    $stmt = $pdo->prepare(
        'SELECT p.id, p.slug, p.name, p.category_label, p.description, p.image_url, p.lat, p.lng, p.status, b.code AS building_code,
                (SELECT COUNT(*) FROM place_entrances e WHERE e.place_id = p.id) AS entrances
         FROM places p LEFT JOIN buildings b ON b.place_id = p.id WHERE p.slug = :s AND p.is_active = 1 LIMIT 1'
    );
    $stmt->execute([':s' => $slug]);
    $place = $stmt->fetch() ?: null;
}

$floors = [];
if ($place && $place['building_code'] !== null) {
    $f = $pdo->prepare('SELECT id, level, name, status, floor_plan_svg, floor_plan_url FROM floors WHERE building_id = :b ORDER BY level');
    $f->execute([':b' => $place['id']]);
    $r = $pdo->prepare('SELECT r.floor_id, r.code, r.name, r.room_type, r.capacity, r.department, r.status, r.plan_x, r.plan_y FROM rooms r JOIN floors f ON f.id = r.floor_id WHERE f.building_id = :b ORDER BY r.code');
    $r->execute([':b' => $place['id']]);
    $rooms = [];
    foreach ($r->fetchAll() as $room) {
        $room['capacity'] = $room['capacity'] === null ? null : (int) $room['capacity'];
        $room['plan_x'] = $room['plan_x'] === null ? null : (float) $room['plan_x'];
        $room['plan_y'] = $room['plan_y'] === null ? null : (float) $room['plan_y'];
        $rooms[$room['floor_id']][] = $room;
    }
    foreach ($f->fetchAll() as $floor) {
        $floors[] = [
            'id' => (int) $floor['id'],
            'level' => (int) $floor['level'],
            'name' => $floor['name'],
            'status' => $floor['status'],
            // Sơ đồ: SVG (đã làm sạch khi lưu) hiển thị qua <img src="data:..."> nên không thể chạy script;
            // hoặc link ảnh (Google Drive / https). Ghim phòng đặt theo % trên ảnh.
            'planSrc' => $floor['floor_plan_svg']
                ? 'data:image/svg+xml;base64,' . base64_encode($floor['floor_plan_svg'])
                : displayable_image($floor['floor_plan_url'], __DIR__),
            'rooms' => $rooms[$floor['id']] ?? [],
        ];
    }
}
$roomCount = array_sum(array_map(fn ($f) => count($f['rooms']), $floors));

// Ảnh: link https (Google Drive đã được chuẩn hoá khi admin lưu) hoặc file có thật trong project.
$image = $place ? displayable_image($place['image_url'], __DIR__) : null;

$buildingList = [];
if (!$place) {
    $buildingList = $pdo->query(
        'SELECT p.slug, p.name, b.code, (SELECT COUNT(*) FROM floors f WHERE f.building_id = p.id) AS floors
         FROM places p JOIN buildings b ON b.place_id = p.id WHERE p.is_active = 1 ORDER BY b.code'
    )->fetchAll();
}
$title = $place['name'] ?? 'Danh sách tòa nhà';
$h = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php echo csrf_meta(); ?>
    <title>TDTU | <?php echo $h($title); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    <link rel="stylesheet" href="css/building-details.css?v=<?php echo @filemtime(__DIR__.'/css/building-details.css') ?: time(); ?>">
</head>
<body>
    <header class="app-header">
        <a href="home.php" class="logo">
            <img src="image/logo.svg" alt="TDTU Logo" height="24" style="margin-right: 8px;">
            <span class="logo-text">BẢN ĐỒ KHUÔN VIÊN TDTU</span>
        </a>
        <nav class="nav-links">
            <a href="home.php">Trang chủ</a>
            <a href="campus-map.php" class="active">Bản đồ</a>
            <a href="navigation.php">Tìm đường</a>
        </nav>
        <?php include __DIR__ . '/includes/user-menu.php'; ?>
    </header>

<?php if (!$place): ?>
    <main class="building-index">
        <h1>Tòa nhà trong khuôn viên</h1>
        <?php if ($slug !== ''): ?><p class="notice-text">Không tìm thấy địa điểm "<?php echo $h($slug); ?>".</p><?php endif; ?>
        <div class="building-cards">
            <?php foreach ($buildingList as $b): ?>
                <a class="building-card" href="building-details.php?slug=<?php echo urlencode($b['slug']); ?>">
                    <span class="building-code"><?php echo $h($b['code']); ?></span>
                    <strong><?php echo $h($b['name']); ?></strong>
                    <small><?php echo (int) $b['floors']; ?> tầng</small>
                </a>
            <?php endforeach; ?>
        </div>
    </main>
<?php else: ?>
    <div class="building-layout">
        <aside class="building-sidebar">
            <?php if ($image): ?>
                <img src="<?php echo $h($image); ?>" alt="<?php echo $h($place['name']); ?>" class="building-image" referrerpolicy="no-referrer" loading="lazy"
                     onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'building-image building-image-placeholder',textContent:<?php echo $h(json_encode($place['building_code'] ?? mb_substr($place['name'], 0, 1))); ?>}))">
            <?php else: ?>
                <div class="building-image building-image-placeholder" aria-hidden="true"><?php echo $h($place['building_code'] ?? mb_substr($place['name'], 0, 1)); ?></div>
            <?php endif; ?>
            <div class="building-info">
                <h1 class="building-title"><?php echo $h($place['name']); ?> <span class="badge"><?php echo $h($place['category_label'] ?? 'Khu vực'); ?></span></h1>
                <?php if ($place['status'] !== 'active'): ?>
                    <p class="status-banner status-<?php echo $h($place['status']); ?>"><?php echo $h(STATUS_LABELS[$place['status']] ?? $place['status']); ?></p>
                <?php endif; ?>
                <?php if ($place['description']): ?><p class="building-desc"><?php echo nl2br($h($place['description'])); ?></p><?php endif; ?>
                <div class="info-grid">
                    <div class="info-item"><div class="info-value"><?php echo count($floors); ?></div><div class="info-label">Số tầng</div></div>
                    <div class="info-item"><div class="info-value"><?php echo $roomCount; ?></div><div class="info-label">Phòng</div></div>
                    <div class="info-item"><div class="info-value"><?php echo (int) $place['entrances']; ?></div><div class="info-label">Lối vào</div></div>
                </div>
                <div class="building-actions">
                    <a class="btn btn-secondary" href="navigation.php?slug=<?php echo urlencode($place['slug']); ?>">Dẫn đường đến đây</a>
                    <a class="btn btn-outline" href="campus-map.php?focus=<?php echo urlencode($place['slug']); ?>">Xem trên bản đồ</a>
                </div>
            </div>
            <?php if ($floors): ?>
            <nav class="floor-selector" aria-label="Chọn tầng">
                <h2 class="text-primary">Các tầng</h2>
                <div class="floor-list">
                    <?php foreach (array_reverse($floors) as $floor): ?>
                        <button type="button" class="floor-btn" data-floor="<?php echo $floor['id']; ?>" aria-pressed="false">
                            <?php echo $h($floor['name']); ?>
                            <span class="floor-badge"><?php echo count($floor['rooms']); ?> phòng</span>
                        </button>
                    <?php endforeach; ?>
                </div>
            </nav>
            <?php endif; ?>
        </aside>

        <section class="floor-map-container" aria-live="polite">
        <?php if ($floors): ?>
            <div class="floor-map-header">
                <h2 id="floorTitle">Sơ đồ tầng</h2>
                <div class="search-container room-search">
                    <label class="sr-only" for="roomSearch">Tìm phòng trong tòa</label>
                    <input type="search" id="roomSearch" class="search-input" placeholder="Tìm phòng (vd: <?php echo $h($floors[0]['rooms'][0]['code'] ?? 'A304'); ?>)" autocomplete="off">
                    <ul id="roomSearchResults" class="room-search-results" hidden></ul>
                </div>
                <div class="map-legend">
                    <div class="legend-item"><span class="legend-color type-classroom"></span> Phòng học</div>
                    <div class="legend-item"><span class="legend-color type-office"></span> Văn phòng</div>
                    <div class="legend-item"><span class="legend-color type-lab"></span> Thí nghiệm</div>
                    <div class="legend-item"><span class="legend-color type-wc"></span> WC / tiện ích</div>
                </div>
            </div>
            <div class="floor-plan-area" id="floorPlanArea"></div>
        <?php else: ?>
            <div class="empty-floor">
                <p>Chưa có dữ liệu tầng/phòng cho "<?php echo $h($place['name']); ?>".</p>
                <?php if (current_admin_id()): ?><p><a href="admin.php#floors">Thêm tầng &amp; phòng trong trang quản trị →</a></p><?php endif; ?>
            </div>
        <?php endif; ?>
        </section>
    </div>
    <script>
        window.BUILDING_DATA = <?php echo json_encode([
            'name' => $place['name'],
            'floors' => $floors,
            'roomTypes' => ROOM_TYPES,
            'statuses' => STATUS_LABELS,
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    </script>
<?php endif; ?>
    <script src="js/main.js?v=<?php echo @filemtime(__DIR__.'/js/main.js') ?: time(); ?>"></script>
    <script src="js/building-details.js?v=<?php echo @filemtime(__DIR__.'/js/building-details.js') ?: time(); ?>"></script>
</body>
</html>
