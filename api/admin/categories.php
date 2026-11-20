<?php
// Danh mục địa điểm. POST JSON {action:"create"|"update", code, name, color?, icon?, sort_order?}
// Không cho xoá danh mục còn địa điểm (khoá ngoại sẽ chặn) - đổi tên/màu thay vì xoá.
require_once __DIR__ . '/../../includes/admin-helpers.php';

$pdo = db();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_out(['results' => $pdo->query(
        'SELECT c.code, c.name, c.color, c.icon, c.sort_order, COUNT(p.id) AS places
         FROM place_categories c LEFT JOIN places p ON p.category_id = c.id AND p.is_active = 1
         GROUP BY c.id ORDER BY c.sort_order, c.name'
    )->fetchAll()]);
}

require_method('POST');
$d = request_data();
$code = strtolower(str_field($d, 'code', 30, true));
if (!preg_match('/^[a-z0-9\-]{2,30}$/', $code)) {
    json_error('Mã danh mục chỉ gồm chữ thường không dấu, số, gạch ngang');
}
$name = str_field($d, 'name', 100, true);
$color = str_field($d, 'color', 30);
if ($color !== '' && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
    json_error('Màu phải có dạng #RRGGBB');
}
$values = [':code' => $code, ':name' => $name, ':color' => $color ?: null, ':icon' => str_field($d, 'icon', 100) ?: null, ':sort' => (int) ($d['sort_order'] ?? 0)];

if (($d['action'] ?? '') === 'create') {
    try {
        $pdo->prepare('INSERT INTO place_categories (code, name, color, icon, sort_order) VALUES (:code, :name, :color, :icon, :sort)')->execute($values);
    } catch (PDOException $e) {
        json_error('Mã danh mục đã tồn tại', 409);
    }
    audit_log('create', 'place_categories', (int) $pdo->lastInsertId(), null, ['code' => $code, 'name' => $name]);
    json_out(['ok' => true], 201);
}
if (($d['action'] ?? '') === 'update') {
    $stmt = $pdo->prepare('UPDATE place_categories SET name = :name, color = :color, icon = :icon, sort_order = :sort WHERE code = :code');
    $stmt->execute($values);
    audit_log('update', 'place_categories', null, null, ['code' => $code, 'name' => $name]);
    json_out(['ok' => true]);
}
json_error('action không hợp lệ');
