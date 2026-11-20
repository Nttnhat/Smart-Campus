<?php
// Tài khoản quản trị đang đăng nhập: xem thông tin, đổi mật khẩu (bắt buộc đổi khỏi "admin" mặc định).
// POST JSON {current_password, new_password}
require_once __DIR__ . '/../../includes/admin-helpers.php';

$pdo = db();
$stmt = $pdo->prepare('SELECT id, username, full_name, email, password_hash, last_login_at FROM admins WHERE id = :id');
$stmt->execute([':id' => current_admin_id()]);
$admin = $stmt->fetch() ?: json_error('Không tìm thấy tài khoản', 404);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_out([
        'username' => $admin['username'],
        'full_name' => $admin['full_name'],
        'email' => $admin['email'],
        'last_login_at' => $admin['last_login_at'],
        // Cảnh báo nếu vẫn dùng mật khẩu mặc định của bản demo.
        'default_password' => password_verify('admin', $admin['password_hash']),
    ]);
}

require_method('POST');
$d = request_data();
$new = (string) ($d['new_password'] ?? '');
if (!password_verify((string) ($d['current_password'] ?? ''), $admin['password_hash'])) {
    json_error('Mật khẩu hiện tại không đúng', 403);
}
if (mb_strlen($new) < 8 || mb_strlen($new) > 72 || $new === 'admin') {
    json_error('Mật khẩu mới phải dài 8–72 ký tự');
}
$pdo->prepare('UPDATE admins SET password_hash = :h WHERE id = :id')->execute([':h' => password_hash($new, PASSWORD_DEFAULT), ':id' => $admin['id']]);
audit_log('update', 'admins', (int) $admin['id'], null, ['password' => 'changed']);
json_out(['ok' => true]);
