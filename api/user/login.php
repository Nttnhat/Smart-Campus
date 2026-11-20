<?php
// Đăng nhập sinh viên. POST JSON: student_code, password.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';
require_method('POST');
require_csrf();

if (login_is_throttled('user')) {
    json_error('Sai quá nhiều lần, hãy thử lại sau 10 phút', 429);
}

$d = request_data();
$code = strtoupper(trim((string) ($d['student_code'] ?? '')));
$password = (string) ($d['password'] ?? '');
if ($code === '' || $password === '') {
    json_error('Thiếu MSSV hoặc mật khẩu');
}

$stmt = db()->prepare('SELECT id, full_name, password_hash, status FROM users WHERE student_code = :c LIMIT 1');
$stmt->execute([':c' => $code]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    login_record_failure('user');
    json_error('MSSV hoặc mật khẩu không đúng', 401);
}
if ($user['status'] !== 'active') {
    json_error('Tài khoản đã bị khoá, liên hệ quản trị viên', 403);
}

login_clear_failures('user');
session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['user_name'] = $user['full_name'];
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')->execute([':id' => $user['id']]);

json_out(['ok' => true, 'user' => ['student_code' => $code, 'full_name' => $user['full_name']]]);
