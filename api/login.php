<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';

$username = trim($_POST['username'] ?? '');
$password = (string) ($_POST['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Thiếu tên đăng nhập hoặc mật khẩu'], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = db()->prepare('SELECT id, password_hash, status FROM admins WHERE username = :u LIMIT 1');
$stmt->execute([':u' => $username]);
$admin = $stmt->fetch();

if (!$admin || $admin['status'] !== 'active' || !password_verify($password, $admin['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Tên đăng nhập hoặc mật khẩu không đúng'], JSON_UNESCAPED_UNICODE);
    exit;
}

session_regenerate_id(true);
$_SESSION['admin_id'] = (int) $admin['id'];

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
