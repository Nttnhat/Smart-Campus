<?php
// Chia sẻ vị trí thời gian thực giữa 2 người dùng (UC-12).
// GET  -> các phiên liên quan tới tôi (đang chờ tôi duyệt, tôi đã mời, đang active), kèm
//         vị trí mới nhất của người kia nếu đang active và chưa hết hạn.
// POST JSON {action: "invite", student_code} -> mời theo MSSV, tạo phiên "pending".
//           {action: "accept" | "decline", id} -> chỉ người được mời (target) mới gọi được.
//           {action: "update", id, lat, lng} -> chỉ 2 bên trong phiên "active" mới gọi được,
//                                               tự gia hạn expires_at thêm 4 giờ.
//           {action: "stop", id} -> 1 trong 2 bên dừng chia sẻ.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';

const SHARE_LIFETIME_HOURS = 4;

// Toạ độ hợp lệ quanh khuôn viên TDTU (giống api/admin/entrances.php, không require file admin
// vì file đó tự ép đăng nhập admin).
function share_coord($lat, $lng): array
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

$uid = current_user_id();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'GET') {
    if (!$uid) {
        json_out(['results' => [], 'loggedIn' => false]);
    }
    $stmt = $pdo->prepare(
        "SELECT s.id, s.status, s.requester_id, s.target_id, s.created_at, s.expires_at,
                CASE WHEN s.requester_id = :u1 THEN s.target_id ELSE s.requester_id END AS other_id,
                CASE WHEN s.requester_id = :u2 THEN tu.full_name ELSE ru.full_name END AS other_name,
                CASE WHEN s.requester_id = :u3 THEN s.target_lat ELSE s.requester_lat END AS other_lat,
                CASE WHEN s.requester_id = :u4 THEN s.target_lng ELSE s.requester_lng END AS other_lng,
                CASE WHEN s.requester_id = :u5 THEN s.target_at ELSE s.requester_at END AS other_at
         FROM location_shares s
         JOIN users ru ON ru.id = s.requester_id
         JOIN users tu ON tu.id = s.target_id
         WHERE (s.requester_id = :u6 OR s.target_id = :u7) AND s.status NOT IN ('declined', 'stopped', 'expired')
         ORDER BY s.created_at DESC"
    );
    $stmt->execute(array_fill_keys([':u1', ':u2', ':u3', ':u4', ':u5', ':u6', ':u7'], $uid));
    $now = new DateTimeImmutable();
    $rows = array_map(function ($r) use ($uid, $now) {
        $expired = new DateTimeImmutable($r['expires_at']) < $now;
        return [
            'id' => (int) $r['id'],
            'status' => $expired && $r['status'] === 'active' ? 'expired' : $r['status'],
            'direction' => (int) $r['requester_id'] === $uid ? 'outgoing' : 'incoming',
            'otherId' => (int) $r['other_id'],
            'otherName' => $r['other_name'],
            'otherPosition' => ($r['status'] === 'active' && !$expired && $r['other_lat'] !== null)
                ? ['lat' => (float) $r['other_lat'], 'lng' => (float) $r['other_lng'], 'at' => $r['other_at']]
                : null,
        ];
    }, $stmt->fetchAll());
    json_out(['results' => $rows, 'loggedIn' => true]);
}

require_method('POST');
require_user_api();

$d = request_data();
$action = (string) ($d['action'] ?? '');

if ($action === 'invite') {
    $code = trim((string) ($d['student_code'] ?? ''));
    if ($code === '') {
        json_error('Thiếu mã số sinh viên');
    }
    $target = $pdo->prepare('SELECT id FROM users WHERE student_code = :c');
    $target->execute([':c' => $code]);
    $targetId = $target->fetchColumn();
    if (!$targetId) {
        json_error('Không tìm thấy sinh viên với MSSV này', 404);
    }
    if ((int) $targetId === $uid) {
        json_error('Không thể tự mời chính mình');
    }
    try {
        $pdo->prepare(
            'INSERT INTO location_shares (requester_id, target_id, status, expires_at)
             VALUES (:r, :t, "pending", DATE_ADD(NOW(), INTERVAL :h HOUR))'
        )->execute([':r' => $uid, ':t' => $targetId, ':h' => SHARE_LIFETIME_HOURS]);
    } catch (PDOException $e) {
        json_error('Đã có lời mời hoặc phiên chia sẻ với người này rồi', 409);
    }
    json_out(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);
}

// Các action còn lại đều thao tác trên 1 phiên có sẵn theo id.
$id = (int) ($d['id'] ?? 0);
$share = $pdo->prepare('SELECT * FROM location_shares WHERE id = :id');
$share->execute([':id' => $id]);
$row = $share->fetch();
if (!$row) {
    json_error('Không tìm thấy phiên chia sẻ', 404);
}
$isRequester = (int) $row['requester_id'] === $uid;
$isTarget = (int) $row['target_id'] === $uid;
if (!$isRequester && !$isTarget) {
    json_error('Không có quyền với phiên chia sẻ này', 403);
}

if ($action === 'accept' || $action === 'decline') {
    if (!$isTarget) {
        json_error('Chỉ người được mời mới chấp nhận/từ chối được', 403);
    }
    if ($row['status'] !== 'pending') {
        json_error('Lời mời không còn ở trạng thái chờ');
    }
    $newStatus = $action === 'accept' ? 'active' : 'declined';
    $pdo->prepare('UPDATE location_shares SET status = :s, expires_at = DATE_ADD(NOW(), INTERVAL :h HOUR) WHERE id = :id')
        ->execute([':s' => $newStatus, ':h' => SHARE_LIFETIME_HOURS, ':id' => $id]);
    json_out(['ok' => true, 'status' => $newStatus]);
}

if ($action === 'update') {
    if ($row['status'] !== 'active') {
        json_error('Phiên chia sẻ chưa (hoặc không còn) hoạt động');
    }
    [$lat, $lng] = share_coord($d['lat'] ?? null, $d['lng'] ?? null);
    $col = $isRequester ? 'requester' : 'target';
    $pdo->prepare(
        "UPDATE location_shares SET {$col}_lat = :lat, {$col}_lng = :lng, {$col}_at = NOW(),
                expires_at = DATE_ADD(NOW(), INTERVAL :h HOUR) WHERE id = :id"
    )->execute([':lat' => $lat, ':lng' => $lng, ':h' => SHARE_LIFETIME_HOURS, ':id' => $id]);
    json_out(['ok' => true]);
}

if ($action === 'stop') {
    if (!in_array($row['status'], ['pending', 'active'], true)) {
        json_error('Phiên chia sẻ đã kết thúc rồi');
    }
    $pdo->prepare('UPDATE location_shares SET status = "stopped" WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true]);
}

json_error('Action không hợp lệ');
