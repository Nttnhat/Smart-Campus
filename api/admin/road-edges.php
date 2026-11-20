<?php
// Chỉnh sửa đồ thị đường đi bộ (router dùng ngay sau khi lưu).
// GET -> mọi cạnh (kể cả đang tắt), gộp 2 chiều: [{id, from, to, a:[lat,lng], b:[lat,lng], type, cost_factor, active}]
// POST JSON:
//   {action:"toggle", id, active}                    bật/tắt (cả 2 chiều) - vd lối đang sửa chữa
//   {action:"update", id, type, cost_factor?}        đổi loại đường (steps để "tránh bậc thang" bỏ qua)
//   {action:"create", a:{lat,lng}, b:{lat,lng}, type} thêm lối đi mới; đầu mút cách nút cũ < 3 m thì nối vào nút đó
//   {action:"delete", id}
require_once __DIR__ . '/../../includes/admin-helpers.php';

// Lưu ý: router (js/lib/walk-router.js) giờ tính chi phí = khoảng cách thuần, không nhân cost_factor
// nữa -> giá trị dưới đây chỉ còn là mặc định lưu vào DB, không ảnh hưởng tới tuyến đường chọn.
const EDGE_TYPES = ['footway' => 1.00, 'service' => 1.04, 'road' => 1.14, 'steps' => 1.55, 'crossing' => 1.00];
$pdo = db();

function edge_pair(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM road_edges WHERE id = :id');
    $stmt->execute([':id' => $id]);
    return $stmt->fetch() ?: json_error('Không tìm thấy đoạn đường', 404);
}

// Điều kiện WHERE cho cả 2 chiều của 1 cạnh.
function pair_where(array $edge): array
{
    return ['((from_node = :a AND to_node = :b) OR (from_node = :b2 AND to_node = :a2))',
        [':a' => $edge['from_node'], ':b' => $edge['to_node'], ':a2' => $edge['from_node'], ':b2' => $edge['to_node']]];
}

function node_for(array $p): int
{
    [$lat, $lng] = campus_coord($p['lat'] ?? null, $p['lng'] ?? null);
    $pdo = db();
    // ~3 m: 0.00003 độ. Tìm nút gần nhất trong ô vuông nhỏ.
    $stmt = $pdo->prepare('SELECT id, lat, lng FROM road_nodes WHERE lat BETWEEN :la1 AND :la2 AND lng BETWEEN :ln1 AND :ln2');
    $stmt->execute([':la1' => $lat - 0.00003, ':la2' => $lat + 0.00003, ':ln1' => $lng - 0.00003, ':ln2' => $lng + 0.00003]);
    $best = null;
    foreach ($stmt->fetchAll() as $n) {
        $dist = hypot(($n['lat'] - $lat) * 111320, ($n['lng'] - $lng) * 109400);
        if ($dist <= 3 && (!$best || $dist < $best[1])) {
            $best = [(int) $n['id'], $dist];
        }
    }
    if ($best) {
        return $best[0];
    }
    $pdo->prepare('INSERT INTO road_nodes (lat, lng, geom) VALUES (:lat, :lng, ST_GeomFromText(:wkt, 4326))')
        ->execute([':lat' => $lat, ':lng' => $lng, ':wkt' => sprintf('POINT(%.7F %.7F)', $lng, $lat)]);
    return (int) $pdo->lastInsertId();
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $rows = $pdo->query(
        'SELECT e.id, e.from_node, e.to_node, e.road_type, e.cost_factor, e.is_active, a.lat AS alat, a.lng AS alng, b.lat AS blat, b.lng AS blng
         FROM road_edges e JOIN road_nodes a ON a.id = e.from_node JOIN road_nodes b ON b.id = e.to_node
         WHERE e.from_node < e.to_node OR NOT EXISTS (SELECT 1 FROM road_edges r WHERE r.from_node = e.to_node AND r.to_node = e.from_node)'
    )->fetchAll();
    json_out(['results' => array_map(fn ($r) => [
        'id' => (int) $r['id'], 'from' => (int) $r['from_node'], 'to' => (int) $r['to_node'],
        'a' => [(float) $r['alat'], (float) $r['alng']], 'b' => [(float) $r['blat'], (float) $r['blng']],
        'type' => $r['road_type'], 'cost_factor' => (float) $r['cost_factor'], 'active' => (bool) $r['is_active'],
    ], $rows)]);
}

require_method('POST');
$d = request_data();
$action = $d['action'] ?? '';

if ($action === 'create') {
    $type = array_key_exists($d['type'] ?? '', EDGE_TYPES) ? $d['type'] : 'footway';
    $pdo->beginTransaction();
    $from = node_for((array) ($d['a'] ?? []));
    $to = node_for((array) ($d['b'] ?? []));
    if ($from === $to) {
        $pdo->rollBack();
        json_error('Hai đầu đoạn đường trùng nhau');
    }
    $nodes = $pdo->prepare('SELECT id, lat, lng FROM road_nodes WHERE id IN (:a, :b)');
    $nodes->execute([':a' => $from, ':b' => $to]);
    $pts = [];
    foreach ($nodes->fetchAll() as $n) {
        $pts[(int) $n['id']] = [(float) $n['lat'], (float) $n['lng']];
    }
    [$alat, $alng] = $pts[$from];
    [$blat, $blng] = $pts[$to];
    $length = round(hypot(($blat - $alat) * 111320, ($blng - $alng) * 111320 * cos(deg2rad($alat))), 2);
    if ($length > 300) {
        $pdo->rollBack();
        json_error('Đoạn đường dài quá 300 m, hãy chia nhỏ');
    }
    $insert = $pdo->prepare(
        'INSERT INTO road_edges (from_node, to_node, name, road_type, length_m, cost_factor, is_bidirectional, pedestrian_only, is_active, geom)
         VALUES (:f, :t, :n, :type, :len, :cf, 1, :ped, 1, ST_GeomFromText(:wkt, 4326))'
    );
    $ids = [];
    foreach ([[$from, $to, $alng, $alat, $blng, $blat], [$to, $from, $blng, $blat, $alng, $alat]] as [$f, $t, $x1, $y1, $x2, $y2]) {
        $insert->execute([
            ':f' => $f, ':t' => $t, ':n' => str_field($d, 'name', 150) ?: 'Lối đi nội bộ', ':type' => $type,
            ':len' => $length, ':cf' => EDGE_TYPES[$type], ':ped' => $type === 'service' || $type === 'road' ? 0 : 1,
            ':wkt' => sprintf('LINESTRING(%.7F %.7F,%.7F %.7F)', $x1, $y1, $x2, $y2),
        ]);
        $ids[] = (int) $pdo->lastInsertId();
    }
    $pdo->commit();
    audit_log('create', 'road_edges', $ids[0], null, ['from' => $from, 'to' => $to, 'type' => $type, 'length_m' => $length]);
    json_out(['ok' => true, 'id' => $ids[0], 'length_m' => $length], 201);
}

$edge = edge_pair((int) ($d['id'] ?? 0));
[$where, $params] = pair_where($edge);

if ($action === 'toggle') {
    $active = empty($d['active']) ? 0 : 1;
    $pdo->prepare("UPDATE road_edges SET is_active = :act WHERE $where")->execute([':act' => $active] + $params);
    audit_log('update', 'road_edges', (int) $edge['id'], ['is_active' => (int) $edge['is_active']], ['is_active' => $active]);
    json_out(['ok' => true]);
}

if ($action === 'update') {
    $type = array_key_exists($d['type'] ?? '', EDGE_TYPES) ? $d['type'] : $edge['road_type'];
    $factor = isset($d['cost_factor']) && is_numeric($d['cost_factor']) ? max(0.5, min(5, (float) $d['cost_factor'])) : EDGE_TYPES[$type];
    $pdo->prepare("UPDATE road_edges SET road_type = :t, cost_factor = :cf WHERE $where")->execute([':t' => $type, ':cf' => $factor] + $params);
    audit_log('update', 'road_edges', (int) $edge['id'], ['type' => $edge['road_type'], 'cost_factor' => (float) $edge['cost_factor']], ['type' => $type, 'cost_factor' => $factor]);
    json_out(['ok' => true]);
}

if ($action === 'delete') {
    $pdo->prepare("DELETE FROM road_edges WHERE $where")->execute($params);
    audit_log('delete', 'road_edges', (int) $edge['id'], ['from' => (int) $edge['from_node'], 'to' => (int) $edge['to_node'], 'type' => $edge['road_type']]);
    json_out(['ok' => true]);
}

json_error('action không hợp lệ');
