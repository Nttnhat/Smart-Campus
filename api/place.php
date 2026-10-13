<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';

$slug = trim($_GET['slug'] ?? '');
if ($slug === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Thiếu slug'], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = db()->prepare(
    'SELECT slug, name, category_label, lat, lng, coverage_json FROM places WHERE slug = :slug AND is_active = 1 LIMIT 1'
);
$stmt->execute([':slug' => $slug]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Không tìm thấy địa điểm'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'id' => $row['slug'],
    'name' => $row['name'],
    'category' => $row['category_label'] ?? 'Khu vực',
    'lat' => (float) $row['lat'],
    'lng' => (float) $row['lng'],
    'hasCoverage' => !empty($row['coverage_json']),
], JSON_UNESCAPED_UNICODE);
