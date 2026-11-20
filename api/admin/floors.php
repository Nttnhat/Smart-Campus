<?php
// Tầng & phòng của một tòa nhà.
// GET ?building=slug -> {building, floors:[{..., rooms:[...]}]}
// POST JSON:
//   {action:"set_building", place, code}                       đánh dấu địa điểm là tòa nhà (có tầng)
//   {action:"create_floor"|"update_floor", building, id?, level, name, status?, floor_plan_svg?}
//   {action:"delete_floor", id}
//   {action:"create_room"|"update_room", floor_id, id?, code, name?, room_type, capacity?, department?, description?, status?}
//   {action:"delete_room", id}
//   {action:"set_room_pin", id, plan_x, plan_y}               ghim phòng lên sơ đồ (% 0–100, null = bỏ ghim)
// Sơ đồ tầng: floor_plan_svg (nội dung file .svg, được làm sạch) HOẶC floor_plan_url (link Google Drive /
// https tới ảnh). clear_plan = true để xoá sơ đồ.
require_once __DIR__ . '/../../includes/admin-helpers.php';
require_once __DIR__ . '/../../includes/media.php';
require_once __DIR__ . '/../../includes/svg-sanitizer.php';

const ROOM_TYPES = ['classroom', 'lab', 'office', 'support', 'stairs', 'elevator', 'wc', 'corridor', 'other'];
const STATUSES = ['active', 'maintenance', 'closed'];
$pdo = db();

function building_of(string $slug): array
{
    $place = require_place($slug);
    $stmt = db()->prepare('SELECT code FROM buildings WHERE place_id = :p');
    $stmt->execute([':p' => $place['id']]);
    $code = $stmt->fetchColumn();
    if ($code === false) {
        json_error('Địa điểm này chưa được đánh dấu là tòa nhà', 404);
    }
    return ['id' => (int) $place['id'], 'slug' => $place['slug'], 'name' => $place['name'], 'code' => $code];
}

function floor_row(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM floors WHERE id = :id');
    $stmt->execute([':id' => $id]);
    return $stmt->fetch() ?: json_error('Không tìm thấy tầng', 404);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $building = building_of(trim((string) ($_GET['building'] ?? '')));
    $floors = $pdo->prepare('SELECT id, level, name, status, floor_plan_svg, floor_plan_url FROM floors WHERE building_id = :b ORDER BY level');
    $floors->execute([':b' => $building['id']]);
    $floors = $floors->fetchAll();
    foreach ($floors as &$fl) {
        // plan_src: dùng thẳng làm src của <img> trong trang admin (SVG -> data URI, ảnh -> link).
        $fl['plan_src'] = $fl['floor_plan_svg'] ? 'data:image/svg+xml;base64,' . base64_encode($fl['floor_plan_svg']) : ($fl['floor_plan_url'] ?: null);
        $fl['plan_type'] = $fl['floor_plan_svg'] ? 'svg' : ($fl['floor_plan_url'] ? 'url' : null);
        unset($fl['floor_plan_svg']);
    }
    unset($fl);
    $rooms = $pdo->prepare('SELECT r.* FROM rooms r JOIN floors f ON f.id = r.floor_id WHERE f.building_id = :b ORDER BY r.code');
    $rooms->execute([':b' => $building['id']]);
    $byFloor = [];
    foreach ($rooms->fetchAll() as $room) {
        $byFloor[$room['floor_id']][] = $room;
    }
    foreach ($floors as &$floor) {
        $floor['rooms'] = $byFloor[$floor['id']] ?? [];
        $floor['has_plan'] = $floor['plan_type'] !== null;
    }
    json_out(['building' => $building, 'floors' => $floors]);
}

require_method('POST');
$d = request_data();
$action = $d['action'] ?? '';

switch ($action) {
    case 'set_building':
        $place = require_place(str_field($d, 'place', 60, true));
        $code = strtoupper(str_field($d, 'code', 10, true));
        $pdo->prepare('INSERT INTO buildings (place_id, code) VALUES (:p, :c) ON DUPLICATE KEY UPDATE code = VALUES(code)')
            ->execute([':p' => $place['id'], ':c' => $code]);
        audit_log('update', 'buildings', (int) $place['id'], null, ['code' => $code]);
        json_out(['ok' => true]);

    case 'create_floor':
    case 'update_floor':
        $building = building_of(str_field($d, 'building', 60, true));
        $level = (int) ($d['level'] ?? 0);
        if ($level < -5 || $level > 60) {
            json_error('Số tầng không hợp lệ');
        }
        $name = str_field($d, 'name', 50, true);
        $status = in_array($d['status'] ?? 'active', STATUSES, true) ? $d['status'] ?? 'active' : 'active';
        // Sơ đồ: chỉ đổi khi request có gửi. SVG được làm sạch; link ảnh được chuẩn hoá (Drive -> link hiển thị).
        $plan = null; // null = giữ nguyên
        if (!empty($d['clear_plan'])) {
            $plan = ['svg' => null, 'url' => null];
        } elseif (isset($d['floor_plan_svg']) && trim((string) $d['floor_plan_svg']) !== '') {
            $clean = sanitize_svg((string) $d['floor_plan_svg']);
            if ($clean === null) {
                json_error('File sơ đồ không phải SVG hợp lệ');
            }
            $plan = ['svg' => $clean, 'url' => null];
        } elseif (isset($d['floor_plan_url']) && trim((string) $d['floor_plan_url']) !== '') {
            $media = normalize_image_url($d['floor_plan_url']);
            if (!$media['ok']) {
                json_error($media['error']);
            }
            // Sơ đồ tầng không cần ảnh to như ảnh địa điểm -> thu nhỏ còn 1080px chiều rộng.
            $media['url'] = str_replace('sz=w1600', 'sz=w1080', $media['url']);
            $plan = ['svg' => null, 'url' => $media['url']];
        }
        try {
            if ($action === 'create_floor') {
                $pdo->prepare('INSERT INTO floors (building_id, level, name, status, floor_plan_svg, floor_plan_url) VALUES (:b, :l, :n, :s, :svg, :url)')
                    ->execute([':b' => $building['id'], ':l' => $level, ':n' => $name, ':s' => $status, ':svg' => $plan['svg'] ?? null, ':url' => $plan['url'] ?? null]);
                $id = (int) $pdo->lastInsertId();
                audit_log('create', 'floors', $id, null, ['building' => $building['slug'], 'level' => $level, 'name' => $name, 'plan' => $plan ? ($plan['svg'] ? 'svg' : $plan['url']) : null]);
                json_out(['ok' => true, 'id' => $id], 201);
            }
            $old = floor_row((int) ($d['id'] ?? 0));
            $sql = 'UPDATE floors SET level = :l, name = :n, status = :s' . ($plan !== null ? ', floor_plan_svg = :svg, floor_plan_url = :url' : '') . ' WHERE id = :id';
            $params = [':l' => $level, ':n' => $name, ':s' => $status, ':id' => $old['id']];
            if ($plan !== null) {
                $params[':svg'] = $plan['svg'];
                $params[':url'] = $plan['url'];
            }
            $pdo->prepare($sql)->execute($params);
            $planLog = fn ($svg, $url) => $svg ? 'svg' : ($url ?: null);
            audit_log('update', 'floors', (int) $old['id'],
                ['level' => (int) $old['level'], 'name' => $old['name'], 'status' => $old['status'], 'plan' => $planLog($old['floor_plan_svg'], $old['floor_plan_url'])],
                ['level' => $level, 'name' => $name, 'status' => $status, 'plan' => $plan === null ? $planLog($old['floor_plan_svg'], $old['floor_plan_url']) : $planLog($plan['svg'], $plan['url'])]);
            json_out(['ok' => true]);
        } catch (PDOException $e) {
            json_error('Tòa này đã có tầng số ' . $level, 409);
        }

    case 'delete_floor':
        $old = floor_row((int) ($d['id'] ?? 0));
        $pdo->prepare('DELETE FROM floors WHERE id = :id')->execute([':id' => $old['id']]);
        audit_log('delete', 'floors', (int) $old['id'], ['level' => (int) $old['level'], 'name' => $old['name']]);
        json_out(['ok' => true]);

    case 'create_room':
    case 'update_room':
        $floor = floor_row((int) ($d['floor_id'] ?? 0));
        $code = strtoupper(str_field($d, 'code', 20, true));
        $type = in_array($d['room_type'] ?? 'classroom', ROOM_TYPES, true) ? $d['room_type'] ?? 'classroom' : 'other';
        $capacity = isset($d['capacity']) && $d['capacity'] !== '' ? max(0, min(2000, (int) $d['capacity'])) : null;
        $values = [
            ':f' => $floor['id'], ':c' => $code, ':n' => str_field($d, 'name', 150) ?: null, ':t' => $type,
            ':cap' => $capacity, ':dep' => str_field($d, 'department', 150) ?: null,
            ':des' => str_field($d, 'description', 1000) ?: null,
            ':s' => in_array($d['status'] ?? 'active', STATUSES, true) ? $d['status'] ?? 'active' : 'active',
        ];
        try {
            if ($action === 'create_room') {
                $pdo->prepare('INSERT INTO rooms (floor_id, code, name, room_type, capacity, department, description, status) VALUES (:f, :c, :n, :t, :cap, :dep, :des, :s)')->execute($values);
                $id = (int) $pdo->lastInsertId();
                audit_log('create', 'rooms', $id, null, ['floor_id' => (int) $floor['id'], 'code' => $code]);
                json_out(['ok' => true, 'id' => $id], 201);
            }
            $values[':id'] = (int) ($d['id'] ?? 0);
            $stmt = $pdo->prepare('UPDATE rooms SET floor_id = :f, code = :c, name = :n, room_type = :t, capacity = :cap, department = :dep, description = :des, status = :s WHERE id = :id');
            $stmt->execute($values);
            if (!$stmt->rowCount()) {
                $check = $pdo->prepare('SELECT 1 FROM rooms WHERE id = :id');
                $check->execute([':id' => $values[':id']]);
                if (!$check->fetchColumn()) {
                    json_error('Không tìm thấy phòng', 404);
                }
            }
            audit_log('update', 'rooms', $values[':id'], null, ['code' => $code, 'floor_id' => (int) $floor['id'], 'status' => $values[':s']]);
            json_out(['ok' => true]);
        } catch (PDOException $e) {
            json_error('Mã phòng ' . $code . ' đã có trên tầng này', 409);
        }

    case 'set_room_pin':
        $stmt = $pdo->prepare('SELECT id, code, plan_x, plan_y FROM rooms WHERE id = :id');
        $stmt->execute([':id' => (int) ($d['id'] ?? 0)]);
        $room = $stmt->fetch() ?: json_error('Không tìm thấy phòng', 404);
        $pin = function ($v) {
            if ($v === null || $v === '') {
                return null;
            }
            if (!is_numeric($v) || $v < 0 || $v > 100) {
                json_error('Vị trí ghim phải từ 0 đến 100 (%)');
            }
            return round((float) $v, 3);
        };
        $x = $pin($d['plan_x'] ?? null);
        $y = $pin($d['plan_y'] ?? null);
        if (($x === null) !== ($y === null)) {
            json_error('Cần đủ cả 2 toạ độ ghim, hoặc bỏ trống cả 2');
        }
        $pdo->prepare('UPDATE rooms SET plan_x = :x, plan_y = :y WHERE id = :id')->execute([':x' => $x, ':y' => $y, ':id' => $room['id']]);
        audit_log('update', 'rooms', (int) $room['id'],
            ['code' => $room['code'], 'plan_x' => $room['plan_x'] === null ? null : (float) $room['plan_x'], 'plan_y' => $room['plan_y'] === null ? null : (float) $room['plan_y']],
            ['code' => $room['code'], 'plan_x' => $x, 'plan_y' => $y]);
        json_out(['ok' => true]);

    case 'delete_room':
        $stmt = $pdo->prepare('SELECT * FROM rooms WHERE id = :id');
        $stmt->execute([':id' => (int) ($d['id'] ?? 0)]);
        $old = $stmt->fetch() ?: json_error('Không tìm thấy phòng', 404);
        $pdo->prepare('DELETE FROM rooms WHERE id = :id')->execute([':id' => $old['id']]);
        audit_log('delete', 'rooms', (int) $old['id'], ['code' => $old['code'], 'floor_id' => (int) $old['floor_id']]);
        json_out(['ok' => true]);
}

json_error('action không hợp lệ');
