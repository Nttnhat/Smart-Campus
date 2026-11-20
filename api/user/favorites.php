<?php
// Địa điểm yêu thích của sinh viên.
// GET  -> danh sách (slug, name, category, lat, lng).
// POST JSON {slug, action: "add" | "remove"}.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';

$uid = current_user_id();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!$uid) {
        json_out(['results' => [], 'loggedIn' => false]);
    }
    $stmt = db()->prepare(
        'SELECT p.slug AS id, p.name, p.category_label AS category, p.lat, p.lng, f.created_at
         FROM user_favorites f JOIN places p ON p.id = f.place_id
         WHERE f.user_id = :u AND p.is_active = 1
         ORDER BY f.created_at DESC'
    );
    $stmt->execute([':u' => $uid]);
    $rows = array_map(function ($r) {
        $r['lat'] = (float) $r['lat'];
        $r['lng'] = (float) $r['lng'];
        return $r;
    }, $stmt->fetchAll());
    json_out(['results' => $rows, 'loggedIn' => true]);
}

require_method('POST');
require_user_api();

$d = request_data();
$slug = trim((string) ($d['slug'] ?? ''));
$action = (string) ($d['action'] ?? 'add');
if ($slug === '' || !in_array($action, ['add', 'remove'], true)) {
    json_error('Thiếu slug hoặc action không hợp lệ');
}

$pdo = db();
$find = $pdo->prepare('SELECT id FROM places WHERE slug = :s AND is_active = 1');
$find->execute([':s' => $slug]);
$placeId = $find->fetchColumn();
if (!$placeId) {
    json_error('Không tìm thấy địa điểm', 404);
}

if ($action === 'add') {
    $pdo->prepare('INSERT IGNORE INTO user_favorites (user_id, place_id) VALUES (:u, :p)')
        ->execute([':u' => $uid, ':p' => $placeId]);
} else {
    $pdo->prepare('DELETE FROM user_favorites WHERE user_id = :u AND place_id = :p')
        ->execute([':u' => $uid, ':p' => $placeId]);
}

json_out(['ok' => true, 'favorite' => $action === 'add']);
