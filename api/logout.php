<?php
// Đăng xuất. ?role=user chỉ thoát tài khoản sinh viên (giữ phiên admin nếu có), mặc định thoát hết.
// Dùng GET qua link nên chỉ chấp nhận khi có token để tránh bị trang khác ép đăng xuất.
require_once __DIR__ . '/../config/auth.php';

$token = $_GET['t'] ?? '';
if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
    header('Location: ../home.php');
    exit;
}

if (($_GET['role'] ?? '') === 'user') {
    unset($_SESSION['user_id'], $_SESSION['user_name']);
    header('Location: ../home.php');
    exit;
}

$_SESSION = [];
session_destroy();
header('Location: ../index.php');
exit;
