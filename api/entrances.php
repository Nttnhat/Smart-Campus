<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';

$slug = trim($_GET['building'] ?? '');
if ($slug === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Thiếu building (slug)'], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = db()->prepare(
    'SELECT e.name, e.lat, e.lng
     FROM place_entrances e
     JOIN places p ON p.id = e.place_id
     WHERE p.slug = :slug'
);
$stmt->execute([':slug' => $slug]);

$results = array_map(function ($r) {
    return ['id' => $r['name'], 'lat' => (float) $r['lat'], 'lng' => (float) $r['lng']];
}, $stmt->fetchAll());

echo json_encode(['results' => $results], JSON_UNESCAPED_UNICODE);
