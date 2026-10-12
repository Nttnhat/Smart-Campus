<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';

// Trả toàn bộ địa điểm đang active, đúng định dạng OFFICIAL_PLACES cũ (id/name/aliases/category/
// lat/lng/coverage) để js/tdtu-vector-map.js nạp thẳng vào, không phải đổi code dùng mảng này ở
// chỗ khác (navigation.js, campus-map.js, admin.js, resolve-place.js...).
$rows = db()->query(
    'SELECT slug, name, aliases, category_label, lat, lng, coverage_json FROM places WHERE is_active = 1 ORDER BY name'
)->fetchAll();

$places = array_map(function ($r) {
    $place = [
        'id' => $r['slug'],
        'name' => $r['name'],
        'aliases' => json_decode($r['aliases'] ?? '[]', true) ?: [],
        'category' => $r['category_label'] ?? 'Khu vực',
        'lat' => (float) $r['lat'],
        'lng' => (float) $r['lng'],
    ];
    if (!empty($r['coverage_json'])) {
        $place['coverage'] = json_decode($r['coverage_json'], true);
    }
    return $place;
}, $rows);

echo json_encode(['results' => $places], JSON_UNESCAPED_UNICODE);
