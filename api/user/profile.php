<?php
// Cập nhật hồ sơ sinh viên. POST JSON: full_name, email?, và (tuỳ chọn) current_password + new_password.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';
require_method('POST');
require_user_api();

$uid = current_user_id();
$d = request_data();
$name = trim((string) ($d['full_name'] ?? ''));
$email = trim((string) ($d['email'] ?? ''));
$current = (string) ($d['current_password'] ?? '');
$new = (string) ($d['new_password'] ?? '');

if ($name === '' || mb_strlen($name) > 150) {
    json_error('Họ tên không hợp lệ');
}
if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 150)) {
    json_error('Email không hợp lệ');
}

$pdo = db();
if ($email !== '') {
    $dup = $pdo->prepare('SELECT 1 FROM users WHERE email = :e AND id <> :id');
    $dup->execute([':e' => $email, ':id' => $uid]);
    if ($dup->fetchColumn()) {
        json_error('Email đã được dùng cho tài khoản khác', 409);
    }
}

$fields = ['full_name = :n', 'email = :e'];
$params = [':n' => $name, ':e' => $email === '' ? null : $email, ':id' => $uid];

if ($new !== '') {
    if (mb_strlen($new) < 8 || mb_strlen($new) > 72) {
        json_error('Mật khẩu mới phải dài 8–72 ký tự');
    }
    $row = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id');
    $row->execute([':id' => $uid]);
    if (!password_verify($current, (string) $row->fetchColumn())) {
        json_error('Mật khẩu hiện tại không đúng', 403);
    }
    $fields[] = 'password_hash = :h';
    $params[':h'] = password_hash($new, PASSWORD_DEFAULT);
}

$pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($params);
$_SESSION['user_name'] = $name;

json_out(['ok' => true]);
