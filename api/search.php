<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/text.php';

$rawQuery = trim($_GET['q'] ?? '');
$category = trim($_GET['category'] ?? '');
$limit = min(max((int)($_GET['limit'] ?? 20), 1), 50);

if (mb_strlen($rawQuery) > 200) {
    http_response_code(400);
    echo json_encode(['error' => 'Từ khóa quá dài'], JSON_UNESCAPED_UNICODE);
    exit;
}

$q = remove_diacritics($rawQuery);

$sql = "SELECT p.id, p.slug, p.name, p.description, p.lat, p.lng,
               c.code AS category_code, c.name AS category_name,
               CASE
                 WHEN p.name_search LIKE :prefix THEN 0
                 WHEN p.name_search LIKE :like THEN 1
                 WHEN p.aliases LIKE :like THEN 2
                 ELSE 3
               END AS relevance
        FROM places p
        JOIN place_categories c ON c.id = p.category_id
        WHERE p.is_active = 1
          AND (:q = '' OR p.name_search LIKE :like OR p.aliases LIKE :like)";
$params = [
    ':q' => $q,
    ':prefix' => $q . '%',
    ':like' => '%' . $q . '%',
];

if ($category !== '') {
    $sql .= " AND c.code = :category";
    $params[':category'] = $category;
}

$sql .= " ORDER BY relevance, p.name LIMIT " . $limit;

$stmt = db()->prepare($sql);
$stmt->execute($params);

echo json_encode(['results' => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
