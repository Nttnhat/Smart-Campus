<?php
// Nhật ký thay đổi dữ liệu (ai sửa gì, lúc nào, trước/sau).
require_once __DIR__ . '/../../includes/admin-helpers.php';

$limit = min(max((int) ($_GET['limit'] ?? 100), 1), 500);
$rows = db()->query(
    "SELECT l.id, l.action, l.entity, l.entity_id, l.old_data, l.new_data, l.created_at, a.username
     FROM audit_logs l LEFT JOIN admins a ON a.id = l.admin_id
     ORDER BY l.id DESC LIMIT $limit"
)->fetchAll();

foreach ($rows as &$row) {
    $row['old_data'] = $row['old_data'] ? json_decode($row['old_data'], true) : null;
    $row['new_data'] = $row['new_data'] ? json_decode($row['new_data'], true) : null;
}
json_out(['results' => $rows]);
