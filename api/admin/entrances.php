<?php
// Lối vào của tòa nhà/khu vực (router chọn lối vào cho tuyến ngắn nhất).
// GET ?place=slug -> danh sách. POST JSON {action:"create"|"update"|"delete", id?, place, name?, type?, lat, lng}
require_once __DIR__ . '/../../includes/admin-helpers.php';

const ENTRANCE_TYPES = ['main', 'side', 'gate', 'vehicle_in', 'vehicle_out'];
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $place = require_place(trim((string) ($_GET['place'] ?? '')));
    $stmt = $pdo->prepare('SELECT id, name, type, lat, lng FROM place_entrances WHERE place_id = :p ORDER BY id');
    $stmt->execute([':p' => $place['id']]);
    json_out(['results' => $stmt->fetchAll()]);
}

require_method('POST');
$d = request_data();
$action = $d['action'] ?? '';

if ($action === 'delete') {
    $stmt = $pdo->prepare('SELECT * FROM place_entrances WHERE id = :id');
    $stmt->execute([':id' => (int) ($d['id'] ?? 0)]);
    $old = $stmt->fetch() ?: json_error('Không tìm thấy lối vào', 404);
    $pdo->prepare('DELETE FROM place_entrances WHERE id = :id')->execute([':id' => $old['id']]);
    audit_log('delete', 'place_entrances', (int) $old['id'], ['place_id' => (int) $old['place_id'], 'lat' => (float) $old['lat'], 'lng' => (float) $old['lng']]);
    json_out(['ok' => true]);
}

$place = require_place(str_field($d, 'place', 60, true));
[$lat, $lng] = campus_coord($d['lat'] ?? null, $d['lng'] ?? null);
$type = in_array($d['type'] ?? 'main', ENTRANCE_TYPES, true) ? ($d['type'] ?? 'main') : 'main';
$name = str_field($d, 'name', 100) ?: null;
$wkt = sprintf('POINT(%.7F %.7F)', $lng, $lat);

if ($action === 'create') {
    $pdo->prepare('INSERT INTO place_entrances (place_id, name, type, lat, lng, geom) VALUES (:p, :n, :t, :lat, :lng, ST_GeomFromText(:wkt, 4326))')
        ->execute([':p' => $place['id'], ':n' => $name, ':t' => $type, ':lat' => $lat, ':lng' => $lng, ':wkt' => $wkt]);
    $id = (int) $pdo->lastInsertId();
    audit_log('create', 'place_entrances', $id, null, ['place' => $place['slug'], 'lat' => $lat, 'lng' => $lng, 'type' => $type]);
    json_out(['ok' => true, 'id' => $id], 201);
}

if ($action === 'update') {
    $id = (int) ($d['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM place_entrances WHERE id = :id AND place_id = :p');
    $stmt->execute([':id' => $id, ':p' => $place['id']]);
    $old = $stmt->fetch() ?: json_error('Không tìm thấy lối vào', 404);
    $pdo->prepare('UPDATE place_entrances SET name = :n, type = :t, lat = :lat, lng = :lng, geom = ST_GeomFromText(:wkt, 4326) WHERE id = :id')
        ->execute([':n' => $name, ':t' => $type, ':lat' => $lat, ':lng' => $lng, ':wkt' => $wkt, ':id' => $id]);
    audit_log('update', 'place_entrances', $id, ['lat' => (float) $old['lat'], 'lng' => (float) $old['lng'], 'type' => $old['type']], ['lat' => $lat, 'lng' => $lng, 'type' => $type]);
    json_out(['ok' => true]);
}

json_error('action không hợp lệ');
