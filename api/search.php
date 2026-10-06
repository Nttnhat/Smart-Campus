<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';

$q = trim($_GET['q'] ?? '');
$category = trim($_GET['category'] ?? '');
$limit = min(max((int)($_GET['limit'] ?? 20), 1), 50);

if (mb_strlen($q) > 200) {
    http_response_code(400);
    echo json_encode(['error' => 'Từ khóa quá dài'], JSON_UNESCAPED_UNICODE);
    exit;
}

$sql = "SELECT p.id, p.slug, p.name, p.description, p.lat, p.lng,
               c.code AS category_code, c.name AS category_name
        FROM places p
        JOIN place_categories c ON c.id = p.category_id
        WHERE p.is_active = 1
          AND (:q = '' OR p.name LIKE :like OR p.aliases LIKE :like)";
$params = [':q' => $q, ':like' => '%' . $q . '%'];

if ($category !== '') {
    $sql .= " AND c.code = :category";
    $params[':category'] = $category;
}

$sql .= " ORDER BY p.name LIMIT " . $limit;

$stmt = db()->prepare($sql);
$stmt->execute($params);

echo json_encode(['results' => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
