<?php
// Hàm dùng chung cho api/admin/*.php. Mọi file require file này đều đã chặn người chưa đăng nhập
// admin (require_admin_api) và kiểm tra CSRF cho request ghi.
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/text.php';
require_admin_api();

function audit_log(string $action, string $entity, ?int $entityId, $old = null, $new = null): void
{
    db()->prepare(
        'INSERT INTO audit_logs (admin_id, action, entity, entity_id, old_data, new_data)
         VALUES (:a, :ac, :e, :id, :o, :n)'
    )->execute([
        ':a' => current_admin_id(),
        ':ac' => $action,
        ':e' => $entity,
        ':id' => $entityId,
        ':o' => $old === null ? null : json_encode($old, JSON_UNESCAPED_UNICODE),
        ':n' => $new === null ? null : json_encode($new, JSON_UNESCAPED_UNICODE),
    ]);
}

function place_row_by_slug(string $slug): ?array
{
    $stmt = db()->prepare('SELECT * FROM places WHERE slug = :s LIMIT 1');
    $stmt->execute([':s' => $slug]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function require_place(string $slug): array
{
    $place = $slug === '' ? null : place_row_by_slug($slug);
    if (!$place) {
        json_error('Không tìm thấy địa điểm', 404);
    }
    return $place;
}

// Toạ độ hợp lệ quanh khuôn viên TDTU (chặn nhập nhầm lat/lng hoặc toạ độ nơi khác).
function campus_coord($lat, $lng): array
{
    if (!is_numeric($lat) || !is_numeric($lng)) {
        json_error('Toạ độ không hợp lệ');
    }
    $lat = (float) $lat;
    $lng = (float) $lng;
    if ($lat < 10.72 || $lat > 10.745 || $lng < 106.685 || $lng > 106.712) {
        json_error('Toạ độ nằm ngoài khu vực khuôn viên TDTU');
    }
    return [$lat, $lng];
}

function str_field(array $d, string $key, int $max, bool $required = false): string
{
    $value = trim((string) ($d[$key] ?? ''));
    if ($required && $value === '') {
        json_error("Thiếu trường $key");
    }
    if (mb_strlen($value) > $max) {
        json_error("Trường $key dài quá $max ký tự");
    }
    return $value;
}
