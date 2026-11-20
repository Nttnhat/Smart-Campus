<?php
// Đăng ký tài khoản sinh viên (tuỳ chọn). POST JSON: student_code, full_name, email?, password.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';
require_method('POST');
require_csrf();

$d = request_data();
$code = strtoupper(trim((string) ($d['student_code'] ?? '')));
$name = trim((string) ($d['full_name'] ?? ''));
$email = trim((string) ($d['email'] ?? ''));
$password = (string) ($d['password'] ?? '');

if (!preg_match('/^[A-Z0-9]{5,20}$/', $code)) {
    json_error('MSSV chỉ gồm chữ và số, dài 5–20 ký tự');
}
if ($name === '' || mb_strlen($name) > 150) {
    json_error('Họ tên không hợp lệ');
}
if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 150)) {
    json_error('Email không hợp lệ');
}
if (mb_strlen($password) < 8 || mb_strlen($password) > 72) {
    json_error('Mật khẩu phải dài 8–72 ký tự');
}

$pdo = db();
$exists = $pdo->prepare('SELECT 1 FROM users WHERE student_code = :c OR (:e <> "" AND email = :e2) LIMIT 1');
$exists->execute([':c' => $code, ':e' => $email, ':e2' => $email]);
if ($exists->fetchColumn()) {
    json_error('MSSV hoặc email đã được đăng ký', 409);
}

$insert = $pdo->prepare(
    'INSERT INTO users (student_code, password_hash, full_name, email, last_login_at)
     VALUES (:c, :h, :n, :e, NOW())'
);
$insert->execute([
    ':c' => $code,
    ':h' => password_hash($password, PASSWORD_DEFAULT),
    ':n' => $name,
    ':e' => $email === '' ? null : $email,
]);

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $pdo->lastInsertId();
$_SESSION['user_name'] = $name;

json_out(['ok' => true, 'user' => ['student_code' => $code, 'full_name' => $name]], 201);
