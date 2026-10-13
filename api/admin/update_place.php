<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';
require_once __DIR__ . '/../../config/text.php';
require_admin_api();

$slug = trim($_POST['slug'] ?? '');
$name = trim($_POST['name'] ?? '');
$category = trim($_POST['category'] ?? '');

if ($slug === '' || $name === '' || $category === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Thiếu dữ liệu'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (mb_strlen($name) > 200 || mb_strlen($category) > 50) {
    http_response_code(400);
    echo json_encode(['error' => 'Tên hoặc danh mục quá dài'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = db();
$find = $pdo->prepare('SELECT id, name, category_label FROM places WHERE slug = :slug LIMIT 1');
$find->execute([':slug' => $slug]);
$old = $find->fetch();
if (!$old) {
    http_response_code(404);
    echo json_encode(['error' => 'Không tìm thấy địa điểm'], JSON_UNESCAPED_UNICODE);
    exit;
}

$update = $pdo->prepare(
    'UPDATE places SET name = :name, category_label = :category, name_search = :ns WHERE slug = :slug'
);
$update->execute([
    ':name' => $name,
    ':category' => $category,
    ':ns' => remove_diacritics($name),
    ':slug' => $slug,
]);

$log = $pdo->prepare(
    'INSERT INTO audit_logs (admin_id, action, entity, entity_id, old_data, new_data) VALUES (:aid, "update", "places", :eid, :old, :new)'
);
$log->execute([
    ':aid' => current_admin_id(),
    ':eid' => $old['id'],
    ':old' => json_encode(['name' => $old['name'], 'category' => $old['category_label']], JSON_UNESCAPED_UNICODE),
    ':new' => json_encode(['name' => $name, 'category' => $category], JSON_UNESCAPED_UNICODE),
]);

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
