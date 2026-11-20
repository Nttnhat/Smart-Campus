<?php
// Tìm phòng theo mã/tên (vd "A003", "phong tai chinh") -> tòa + tầng để dẫn đường tới đúng tòa.
// GET ?q=...  ->  {results:[{code, name, room_type, building:{slug,name,lat,lng}, floor:{level,name}}]}
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/text.php';

$raw = trim((string) ($_GET['q'] ?? ''));
if ($raw === '' || mb_strlen($raw) > 50) {
    json_out(['results' => []]);
}
$code = strtoupper(preg_replace('/\s+/', '', $raw));
$stmt = db()->prepare(
    "SELECT r.code, r.name, r.room_type, p.slug, p.name AS building_name, p.lat, p.lng, f.level, f.name AS floor_name
     FROM rooms r JOIN floors f ON f.id = r.floor_id JOIN places p ON p.id = f.building_id
     WHERE p.is_active = 1 AND r.status <> 'closed' AND (r.code LIKE :code OR r.name LIKE :name)
     ORDER BY (r.code = :exact) DESC, r.code LIMIT 10"
);
$stmt->execute([':code' => $code . '%', ':name' => '%' . $raw . '%', ':exact' => $code]);

json_out(['results' => array_map(fn ($r) => [
    'code' => $r['code'],
    'name' => $r['name'],
    'room_type' => $r['room_type'],
    'building' => ['slug' => $r['slug'], 'name' => $r['building_name'], 'lat' => (float) $r['lat'], 'lng' => (float) $r['lng']],
    'floor' => ['level' => (int) $r['level'], 'name' => $r['floor_name']],
], $stmt->fetchAll())]);
