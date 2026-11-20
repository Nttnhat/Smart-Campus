<?php
// Số liệu thật cho Dashboard admin (thay cho số giả 128 / 4,502 trước đây).
require_once __DIR__ . '/../../includes/admin-helpers.php';

$pdo = db();
$one = fn (string $sql) => (int) $pdo->query($sql)->fetchColumn();

$totals = [
    'places' => $one('SELECT COUNT(*) FROM places WHERE is_active = 1'),
    'buildings' => $one('SELECT COUNT(*) FROM buildings'),
    'floors' => $one('SELECT COUNT(*) FROM floors'),
    'rooms' => $one('SELECT COUNT(*) FROM rooms'),
    'entrances' => $one('SELECT COUNT(*) FROM place_entrances'),
    'places_with_entrances' => $one('SELECT COUNT(DISTINCT place_id) FROM place_entrances'),
    'edges_active' => $one('SELECT COUNT(*) FROM road_edges WHERE is_active = 1'),
    'edges_inactive' => $one('SELECT COUNT(*) FROM road_edges WHERE is_active = 0'),
    'users' => $one('SELECT COUNT(*) FROM users'),
    'searches_7d' => $one('SELECT COUNT(*) FROM search_logs WHERE created_at >= NOW() - INTERVAL 7 DAY'),
    'routes_7d' => $one('SELECT COUNT(*) FROM route_logs WHERE created_at >= NOW() - INTERVAL 7 DAY'),
];

$daily = $pdo->query(
    "SELECT d, SUM(s) AS searches, SUM(r) AS routes FROM (
        SELECT DATE(created_at) d, COUNT(*) s, 0 r FROM search_logs WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY d
        UNION ALL
        SELECT DATE(created_at) d, 0 s, COUNT(*) r FROM route_logs WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY d
     ) t GROUP BY d ORDER BY d"
)->fetchAll();

$topDestinations = $pdo->query(
    'SELECT p.slug, p.name, COUNT(*) AS total FROM route_logs r JOIN places p ON p.id = r.dest_place_id
     WHERE r.created_at >= NOW() - INTERVAL 30 DAY GROUP BY p.id ORDER BY total DESC LIMIT 8'
)->fetchAll();

$topKeywords = $pdo->query(
    "SELECT keyword, COUNT(*) AS total FROM search_logs WHERE keyword <> '' AND created_at >= NOW() - INTERVAL 30 DAY
     GROUP BY keyword ORDER BY total DESC LIMIT 8"
)->fetchAll();

// Tìm nhưng không ra kết quả -> gợi ý admin bổ sung địa điểm/bí danh.
$missed = $pdo->query(
    "SELECT keyword, COUNT(*) AS total FROM search_logs WHERE result_count = 0 AND keyword <> ''
     AND created_at >= NOW() - INTERVAL 30 DAY GROUP BY keyword ORDER BY total DESC LIMIT 8"
)->fetchAll();

json_out(['totals' => $totals, 'daily' => $daily, 'topDestinations' => $topDestinations, 'topKeywords' => $topKeywords, 'missedKeywords' => $missed]);
