<?php
// Trạng thái phiên hiện tại. Khách: loggedIn=false (vẫn dùng mọi tính năng bản đồ).
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';

$uid = current_user_id();
if (!$uid) {
    json_out(['loggedIn' => false, 'isAdmin' => (bool) current_admin_id()]);
}

$stmt = db()->prepare('SELECT student_code, full_name, email, created_at, last_login_at FROM users WHERE id = :id');
$stmt->execute([':id' => $uid]);
$user = $stmt->fetch();
if (!$user) {
    unset($_SESSION['user_id'], $_SESSION['user_name']);
    json_out(['loggedIn' => false, 'isAdmin' => (bool) current_admin_id()]);
}

json_out(['loggedIn' => true, 'isAdmin' => (bool) current_admin_id(), 'user' => $user]);
