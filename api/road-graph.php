<?php
// Đồ thị đường đi bộ nội bộ từ database (road_nodes / road_edges) - nguồn chính cho router.
// Admin bật/tắt/sửa cạnh trong trang quản trị -> mọi người dùng nhận đồ thị mới ngay.
// Định dạng gọn để tải nhanh trên điện thoại:
//   nodes: [[id, lat, lng], ...]
//   edges: [[id, from, to, type, cost_factor, nameIndex], ...], names: ["Đường nội bộ ...", ...]
require_once __DIR__ . '/../config/db.php';

$pdo = db();
$nodes = $pdo->query('SELECT id, lat, lng FROM road_nodes')->fetchAll(PDO::FETCH_NUM);
$rows = $pdo->query(
    'SELECT id, from_node, to_node, road_type, cost_factor, name FROM road_edges WHERE is_active = 1'
)->fetchAll(PDO::FETCH_NUM);

$names = [];
$nameIndex = [];
$edges = [];
foreach ($rows as [$id, $from, $to, $type, $factor, $name]) {
    $name = (string) $name;
    if (!isset($nameIndex[$name])) {
        $nameIndex[$name] = count($names);
        $names[] = $name;
    }
    $edges[] = [(int) $id, (int) $from, (int) $to, $type, (float) $factor, $nameIndex[$name]];
}

$payload = json_encode([
    'source' => 'database',
    'nodes' => array_map(fn ($n) => [(int) $n[0], (float) $n[1], (float) $n[2]], $nodes),
    'edges' => $edges,
    'names' => $names,
], JSON_UNESCAPED_UNICODE);

$etag = '"' . md5($payload) . '"';
header('ETag: ' . $etag);
header('Cache-Control: no-cache');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
header('Content-Type: application/json; charset=utf-8');
echo $payload;
