<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/text.php';

$q = remove_diacritics($_GET['q'] ?? '');
if ($q === '' || mb_strlen($q) > 100) {
    echo json_encode(['results' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = db()->prepare(
    "SELECT p.id, p.name, c.name AS category_name
     FROM places p
     JOIN place_categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND p.name_search LIKE :prefix
     ORDER BY p.name LIMIT 8"
);
$stmt->execute([':prefix' => $q . '%']);

echo json_encode(['results' => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
