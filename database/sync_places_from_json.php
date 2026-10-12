<?php
// Chạy 1 lần (CLI): đồng bộ database/places_export.json (xuất từ OFFICIAL_PLACES trong
// js/tdtu-vector-map.js) vào bảng `places`. Khớp theo slug: có thì UPDATE, chưa có thì INSERT.
// category_id chỉ cần hợp lệ cho khóa ngoại - cột category_label mới là nguồn hiển thị thật,
// giữ đúng nhãn ngắn gọn ('Tòa nhà', 'Khu vực'...) mà frontend đang dùng.
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/text.php';

$pdo = db();
$places = json_decode(file_get_contents(__DIR__ . '/places_export.json'), true);

$fallbackCategoryId = (int) $pdo->query("SELECT id FROM place_categories WHERE code = 'khu-vuc' LIMIT 1")->fetchColumn();

$findId = $pdo->prepare('SELECT id FROM places WHERE slug = :slug');
$insert = $pdo->prepare(
    'INSERT INTO places (slug, category_id, category_label, name, aliases, name_search, lat, lng, geom, coverage_json, status, is_active)
     VALUES (:slug, :category_id, :category_label, :name, :aliases, :name_search, :lat, :lng, ST_GeomFromText(:geom), :coverage_json, "active", 1)'
);
$update = $pdo->prepare(
    'UPDATE places SET category_label = :category_label, name = :name, aliases = :aliases,
       name_search = :name_search, lat = :lat, lng = :lng, geom = ST_GeomFromText(:geom),
       coverage_json = :coverage_json
     WHERE slug = :slug'
);

$inserted = 0; $updated = 0;
foreach ($places as $p) {
    $geomText = "POINT({$p['lng']} {$p['lat']})";
    $params = [
        ':slug' => $p['id'],
        ':category_label' => $p['category'],
        ':name' => $p['name'],
        ':aliases' => json_encode($p['aliases'] ?? [], JSON_UNESCAPED_UNICODE),
        ':name_search' => remove_diacritics($p['name']),
        ':lat' => $p['lat'],
        ':lng' => $p['lng'],
        ':geom' => $geomText,
        ':coverage_json' => isset($p['coverage']) ? json_encode($p['coverage'], JSON_UNESCAPED_UNICODE) : null,
    ];

    $findId->execute([':slug' => $p['id']]);
    $exists = $findId->fetchColumn();
    if ($exists) {
        $update->execute($params);
        $updated++;
    } else {
        $params[':category_id'] = $fallbackCategoryId;
        $insert->execute($params);
        $inserted++;
    }
}

echo "Đồng bộ xong: {$updated} cập nhật, {$inserted} thêm mới.\n";
