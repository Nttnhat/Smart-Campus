<?php
// Chạy 1 lần (CLI): đồng bộ database/entrances_export.json (xuất từ ENTRANCES trong
// js/lib/entrances.js) vào bảng `place_entrances`. Khớp `building` (slug) -> `places.id`.
// Idempotent: xóa hết lối vào cũ của 1 tòa trước khi chèn lại, chạy lại nhiều lần không bị trùng.
require_once __DIR__ . '/../config/db.php';

$pdo = db();
$entrances = json_decode(file_get_contents(__DIR__ . '/entrances_export.json'), true);

$findPlaceId = $pdo->prepare('SELECT id FROM places WHERE slug = :slug LIMIT 1');
$deleteOld = $pdo->prepare('DELETE FROM place_entrances WHERE place_id = :place_id');
$insert = $pdo->prepare(
    'INSERT INTO place_entrances (place_id, name, type, lat, lng, geom) VALUES (:place_id, :name, "main", :lat, :lng, ST_GeomFromText(:geom))'
);

$byBuilding = [];
foreach ($entrances as $e) {
    $byBuilding[$e['building']][] = $e;
}

$inserted = 0; $skippedBuildings = [];
foreach ($byBuilding as $slug => $rows) {
    $findPlaceId->execute([':slug' => $slug]);
    $placeId = $findPlaceId->fetchColumn();
    if (!$placeId) {
        $skippedBuildings[] = $slug;
        continue;
    }
    $deleteOld->execute([':place_id' => $placeId]);
    foreach ($rows as $e) {
        $insert->execute([
            ':place_id' => $placeId,
            ':name' => $e['id'],
            ':lat' => $e['lat'],
            ':lng' => $e['lng'],
            ':geom' => "POINT({$e['lng']} {$e['lat']})",
        ]);
        $inserted++;
    }
}

echo "Đã chèn {$inserted} lối vào.\n";
if ($skippedBuildings) {
    echo "Bỏ qua (không tìm thấy place.slug tương ứng): " . implode(', ', $skippedBuildings) . "\n";
}
