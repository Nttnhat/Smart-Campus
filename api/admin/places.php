<?php
// CRUD địa điểm.
// GET -> mọi địa điểm (kể cả đang ẩn) + danh mục.
// POST JSON {action:"create"|"update"|"delete"|"restore", slug, name, category_code, category_label?,
//            aliases?: string[], description?, image_url?, lat, lng, status?, coverage?}
// "delete" là ẩn (is_active = 0) để giữ lịch sử/log; "restore" hiện lại.
require_once __DIR__ . '/../../includes/admin-helpers.php';
require_once __DIR__ . '/../../includes/media.php';

$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $places = $pdo->query(
        'SELECT p.slug AS id, p.name, p.aliases, p.category_label AS category, c.code AS category_code,
                p.description, p.image_url, p.lat, p.lng, p.status, p.is_active, p.coverage_json,
                (SELECT COUNT(*) FROM place_entrances e WHERE e.place_id = p.id) AS entrance_count,
                (b.place_id IS NOT NULL) AS is_building, b.code AS building_code
         FROM places p JOIN place_categories c ON c.id = p.category_id
         LEFT JOIN buildings b ON b.place_id = p.id
         ORDER BY p.is_active DESC, p.name'
    )->fetchAll();
    foreach ($places as &$p) {
        $p['aliases'] = json_decode($p['aliases'] ?? '[]', true) ?: [];
        $p['lat'] = (float) $p['lat'];
        $p['lng'] = (float) $p['lng'];
        $p['is_active'] = (bool) $p['is_active'];
        $p['is_building'] = (bool) $p['is_building'];
        $p['entrance_count'] = (int) $p['entrance_count'];
        $p['coverage'] = $p['coverage_json'] ? json_decode($p['coverage_json'], true) : null;
        unset($p['coverage_json']);
    }
    $categories = $pdo->query('SELECT code, name, color FROM place_categories ORDER BY sort_order, name')->fetchAll();
    $labels = $pdo->query("SELECT DISTINCT category_label FROM places WHERE category_label IS NOT NULL AND category_label <> '' ORDER BY 1")->fetchAll(PDO::FETCH_COLUMN);
    json_out(['results' => $places, 'categories' => $categories, 'labels' => $labels]);
}

require_method('POST');
$d = request_data();
$action = $d['action'] ?? '';
$slug = strtolower(str_field($d, 'slug', 60, true));

if (in_array($action, ['delete', 'restore'], true)) {
    $place = require_place($slug);
    $active = $action === 'restore' ? 1 : 0;
    $pdo->prepare('UPDATE places SET is_active = :a WHERE id = :id')->execute([':a' => $active, ':id' => $place['id']]);
    audit_log($action === 'restore' ? 'update' : 'delete', 'places', (int) $place['id'], ['is_active' => (int) $place['is_active']], ['is_active' => $active]);
    json_out(['ok' => true]);
}

if (!in_array($action, ['create', 'update'], true)) {
    json_error('action không hợp lệ');
}
if (!preg_match('/^[a-z0-9][a-z0-9\-]{1,59}$/', $slug)) {
    json_error('Mã (slug) chỉ gồm chữ thường không dấu, số và dấu gạch ngang');
}

$name = str_field($d, 'name', 200, true);
$code = str_field($d, 'category_code', 30, true);
$cat = $pdo->prepare('SELECT id, name FROM place_categories WHERE code = :c');
$cat->execute([':c' => $code]);
$category = $cat->fetch();
if (!$category) {
    json_error('Danh mục không tồn tại');
}
$label = str_field($d, 'category_label', 50) ?: $category['name'];
[$lat, $lng] = campus_coord($d['lat'] ?? null, $d['lng'] ?? null);
$aliases = array_values(array_filter(array_map(
    fn ($a) => mb_substr(trim((string) $a), 0, 80),
    is_array($d['aliases'] ?? null) ? $d['aliases'] : explode(',', (string) ($d['aliases'] ?? ''))
)));
$status = in_array($d['status'] ?? 'active', ['active', 'maintenance', 'closed'], true) ? ($d['status'] ?? 'active') : 'active';
// Ảnh: link Google Drive (tự đổi sang link hiển thị) hoặc link https; không upload file lên hosting.
$image = normalize_image_url($d['image_url'] ?? '');
if (!$image['ok']) {
    json_error($image['error']);
}
$coverage = null;
if (!empty($d['coverage']) && is_array($d['coverage']) && in_array($d['coverage']['type'] ?? '', ['circle', 'square', 'polygon'], true)) {
    $coverage = json_encode($d['coverage'], JSON_UNESCAPED_UNICODE);
}

$values = [
    ':slug' => $slug,
    ':cid' => $category['id'],
    ':label' => $label,
    ':name' => $name,
    ':aliases' => json_encode($aliases, JSON_UNESCAPED_UNICODE),
    ':ns' => remove_diacritics($name),
    ':descr' => str_field($d, 'description', 2000) ?: null,
    ':img' => $image['url'] ?: null,
    ':lat' => $lat,
    ':lng' => $lng,
    ':wkt' => sprintf('POINT(%.7F %.7F)', $lng, $lat),
    ':status' => $status,
];

if ($action === 'create') {
    if (place_row_by_slug($slug)) {
        json_error('Mã (slug) đã tồn tại', 409);
    }
    $sql = 'INSERT INTO places (slug, category_id, category_label, name, aliases, name_search, description, image_url, lat, lng, geom, status'
        . ($coverage !== null ? ', coverage_json' : '') . ')
            VALUES (:slug, :cid, :label, :name, :aliases, :ns, :descr, :img, :lat, :lng, ST_GeomFromText(:wkt), :status'
        . ($coverage !== null ? ', :cov' : '') . ')';
    if ($coverage !== null) {
        $values[':cov'] = $coverage;
    }
    $pdo->prepare($sql)->execute($values);
    $id = (int) $pdo->lastInsertId();
    audit_log('create', 'places', $id, null, ['slug' => $slug, 'name' => $name, 'category' => $label, 'lat' => $lat, 'lng' => $lng]);
    json_out(['ok' => true, 'id' => $slug], 201);
}

$old = require_place($slug);
$sql = 'UPDATE places SET category_id = :cid, category_label = :label, name = :name, aliases = :aliases, name_search = :ns,
               description = :descr, image_url = :img, lat = :lat, lng = :lng, geom = ST_GeomFromText(:wkt), status = :status'
    . (array_key_exists('coverage', $d) ? ', coverage_json = :cov' : '') . ' WHERE slug = :slug';
if (array_key_exists('coverage', $d)) {
    $values[':cov'] = $coverage;
}
$pdo->prepare($sql)->execute($values);
audit_log('update', 'places', (int) $old['id'],
    ['name' => $old['name'], 'category' => $old['category_label'], 'lat' => (float) $old['lat'], 'lng' => (float) $old['lng'], 'status' => $old['status']],
    ['name' => $name, 'category' => $label, 'lat' => $lat, 'lng' => $lng, 'status' => $status]);
json_out(['ok' => true, 'id' => $slug]);
