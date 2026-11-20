<?php
// Quản lý tài khoản sinh viên: xem danh sách, tạo mới, khoá/mở khoá, đặt lại mật khẩu, xoá.
// Không có đăng ký tự do (login.php chỉ còn tab Sinh viên để đăng nhập) - admin tạo tài khoản ở đây.
// POST JSON {action:"create"|"lock"|"unlock"|"reset_password"|"delete", id?, student_code?, full_name?, email?, password|new_password?}
require_once __DIR__ . '/../../includes/admin-helpers.php';

$pdo = db();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $rows = $pdo->query(
        'SELECT u.id, u.student_code, u.full_name, u.email, u.status, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM user_favorites f WHERE f.user_id = u.id) AS favorites,
                (SELECT COUNT(*) FROM route_logs r WHERE r.user_id = u.id) AS routes
         FROM users u ORDER BY u.created_at DESC LIMIT 500'
    )->fetchAll();
    json_out(['results' => $rows]);
}

require_method('POST');
$d = request_data();

if (($d['action'] ?? '') === 'create') {
    $code = strtoupper(str_field($d, 'student_code', 20, true));
    $name = str_field($d, 'full_name', 150, true);
    $email = str_field($d, 'email', 150);
    $password = (string) ($d['password'] ?? '');
    if (!preg_match('/^[A-Z0-9]{5,20}$/', $code)) {
        json_error('MSSV chỉ gồm chữ và số, dài 5–20 ký tự');
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Email không hợp lệ');
    }
    if (mb_strlen($password) < 8 || mb_strlen($password) > 72) {
        json_error('Mật khẩu phải dài 8–72 ký tự');
    }
    $exists = $pdo->prepare('SELECT 1 FROM users WHERE student_code = :c OR (:e <> "" AND email = :e2) LIMIT 1');
    $exists->execute([':c' => $code, ':e' => $email, ':e2' => $email]);
    if ($exists->fetchColumn()) {
        json_error('MSSV hoặc email đã được đăng ký', 409);
    }
    $insert = $pdo->prepare(
        'INSERT INTO users (student_code, password_hash, full_name, email) VALUES (:c, :h, :n, :e)'
    );
    $insert->execute([
        ':c' => $code,
        ':h' => password_hash($password, PASSWORD_DEFAULT),
        ':n' => $name,
        ':e' => $email === '' ? null : $email,
    ]);
    $newId = (int) $pdo->lastInsertId();
    audit_log('create', 'users', $newId, null, ['student_code' => $code, 'full_name' => $name]);
    json_out(['ok' => true, 'id' => $newId], 201);
}

$stmt = $pdo->prepare('SELECT id, student_code, status FROM users WHERE id = :id');
$stmt->execute([':id' => (int) ($d['id'] ?? 0)]);
$user = $stmt->fetch() ?: json_error('Không tìm thấy tài khoản', 404);

switch ($d['action'] ?? '') {
    case 'lock':
    case 'unlock':
        $status = $d['action'] === 'lock' ? 'locked' : 'active';
        $pdo->prepare('UPDATE users SET status = :s WHERE id = :id')->execute([':s' => $status, ':id' => $user['id']]);
        audit_log('update', 'users', (int) $user['id'], ['status' => $user['status']], ['status' => $status]);
        json_out(['ok' => true]);
    case 'reset_password':
        $new = (string) ($d['new_password'] ?? '');
        if (mb_strlen($new) < 8 || mb_strlen($new) > 72) {
            json_error('Mật khẩu mới phải dài 8–72 ký tự');
        }
        $pdo->prepare('UPDATE users SET password_hash = :h WHERE id = :id')->execute([':h' => password_hash($new, PASSWORD_DEFAULT), ':id' => $user['id']]);
        audit_log('update', 'users', (int) $user['id'], null, ['password' => 'reset']);
        json_out(['ok' => true]);
    case 'delete':
        $pdo->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $user['id']]);
        audit_log('delete', 'users', (int) $user['id'], ['student_code' => $user['student_code']]);
        json_out(['ok' => true]);
}
json_error('action không hợp lệ');
