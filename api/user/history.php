<?php
// Lịch sử tìm kiếm và lộ trình gần đây của sinh viên đang đăng nhập.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';

$uid = current_user_id();
if (!$uid) {
    json_out(['searches' => [], 'routes' => [], 'loggedIn' => false]);
}

$pdo = db();
$searches = $pdo->prepare(
    'SELECT s.keyword, p.slug, p.name AS place_name, s.created_at
     FROM search_logs s LEFT JOIN places p ON p.id = s.selected_place_id
     WHERE s.user_id = :u ORDER BY s.created_at DESC LIMIT 20'
);
$searches->execute([':u' => $uid]);

$routes = $pdo->prepare(
    'SELECT r.origin_type, op.name AS origin_name, dp.slug AS dest_slug, dp.name AS dest_name,
            r.dest_lat, r.dest_lng, r.distance_m, r.duration_s, r.created_at
     FROM route_logs r
     LEFT JOIN places op ON op.id = r.origin_place_id
     LEFT JOIN places dp ON dp.id = r.dest_place_id
     WHERE r.user_id = :u ORDER BY r.created_at DESC LIMIT 20'
);
$routes->execute([':u' => $uid]);

json_out(['loggedIn' => true, 'searches' => $searches->fetchAll(), 'routes' => $routes->fetchAll()]);
