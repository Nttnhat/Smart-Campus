<?php
// Ghi log tìm kiếm / lộ trình (cho cả khách lẫn sinh viên) để admin xem thống kê thật.
// POST JSON:
//   {type:"search", keyword, result_count, selected_slug?}
//   {type:"route", origin_type:"gps|place|map_click", origin_slug?, origin_lat?, origin_lng?,
//    dest_slug?, dest_lat, dest_lng, distance_m, duration_s, avoid_steps?}
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';
require_method('POST');
require_csrf();

// Giới hạn đơn giản 60 log / phút / phiên để không bị spam bảng log.
$now = time();
$bucket = $_SESSION['log_bucket'] ?? ['start' => $now, 'count' => 0];
if ($now - $bucket['start'] >= 60) {
    $bucket = ['start' => $now, 'count' => 0];
}
if (++$bucket['count'] > 60) {
    json_error('Quá nhiều yêu cầu', 429);
}
$_SESSION['log_bucket'] = $bucket;

$d = request_data();
$pdo = db();
$uid = current_user_id();

function place_id_by_slug(PDO $pdo, $slug): ?int
{
    $slug = trim((string) $slug);
    if ($slug === '') {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id FROM places WHERE slug = :s');
    $stmt->execute([':s' => $slug]);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function coord($value, float $min, float $max): ?float
{
    if ($value === null || $value === '' || !is_numeric($value)) {
        return null;
    }
    $v = (float) $value;
    return ($v >= $min && $v <= $max) ? $v : null;
}

$type = $d['type'] ?? '';
if ($type === 'search') {
    $keyword = mb_substr(trim((string) ($d['keyword'] ?? '')), 0, 200);
    if ($keyword === '' && empty($d['selected_slug'])) {
        json_error('Thiếu từ khoá');
    }
    $pdo->prepare(
        'INSERT INTO search_logs (user_id, keyword, selected_place_id, result_count) VALUES (:u, :k, :p, :c)'
    )->execute([
        ':u' => $uid,
        ':k' => $keyword,
        ':p' => place_id_by_slug($pdo, $d['selected_slug'] ?? ''),
        ':c' => max(0, min(1000, (int) ($d['result_count'] ?? 0))),
    ]);
    json_out(['ok' => true], 201);
}

if ($type === 'route') {
    $originType = in_array($d['origin_type'] ?? '', ['gps', 'place', 'map_click'], true) ? $d['origin_type'] : 'map_click';
    $originLat = coord($d['origin_lat'] ?? null, -90, 90);
    $originLng = coord($d['origin_lng'] ?? null, -180, 180);
    $pdo->prepare(
        'INSERT INTO route_logs (user_id, origin_type, origin_place_id, origin_lat, origin_lng,
                                 dest_place_id, dest_lat, dest_lng, distance_m, duration_s, avoid_steps)
         VALUES (:u, :ot, :op, :ola, :olg, :dp, :dla, :dlg, :dist, :dur, :st)'
    )->execute([
        ':u' => $uid,
        ':ot' => $originType,
        ':op' => place_id_by_slug($pdo, $d['origin_slug'] ?? ''),
        // Vị trí xuất phát chỉ lưu làm tròn ~11 m để bảo vệ quyền riêng tư.
        ':ola' => $originLat === null ? null : round($originLat, 4),
        ':olg' => $originLng === null ? null : round($originLng, 4),
        ':dp' => place_id_by_slug($pdo, $d['dest_slug'] ?? ''),
        ':dla' => coord($d['dest_lat'] ?? null, -90, 90),
        ':dlg' => coord($d['dest_lng'] ?? null, -180, 180),
        ':dist' => max(0, min(100000, (float) ($d['distance_m'] ?? 0))),
        ':dur' => max(0, min(86400, (int) ($d['duration_s'] ?? 0))),
        ':st' => empty($d['avoid_steps']) ? 0 : 1,
    ]);
    json_out(['ok' => true], 201);
}

json_error('type phải là "search" hoặc "route"');
