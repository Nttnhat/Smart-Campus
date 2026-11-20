<?php
// Đăng nhập QUẢN TRỊ (bảng admins). Sinh viên dùng api/user/login.php.
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';
require_method('POST');
require_csrf();

if (login_is_throttled('admin')) {
    json_error('Sai quá nhiều lần, hãy thử lại sau 10 phút', 429);
}

$d = request_data();
$username = trim((string) ($d['username'] ?? ''));
$password = (string) ($d['password'] ?? '');
if ($username === '' || $password === '') {
    json_error('Thiếu tên đăng nhập hoặc mật khẩu');
}

$stmt = db()->prepare('SELECT id, password_hash, status FROM admins WHERE username = :u LIMIT 1');
$stmt->execute([':u' => $username]);
$admin = $stmt->fetch();

if (!$admin || $admin['status'] !== 'active' || !password_verify($password, $admin['password_hash'])) {
    login_record_failure('admin');
    json_error('Tên đăng nhập hoặc mật khẩu không đúng', 401);
}

login_clear_failures('admin');
session_regenerate_id(true);
$_SESSION['admin_id'] = (int) $admin['id'];
db()->prepare('UPDATE admins SET last_login_at = NOW() WHERE id = :id')->execute([':id' => $admin['id']]);

json_out(['ok' => true]);
