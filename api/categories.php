<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';

$rows = db()->query(
    "SELECT code, name, icon, color FROM place_categories ORDER BY sort_order, name"
)->fetchAll();

echo json_encode(['results' => $rows], JSON_UNESCAPED_UNICODE);
