<?php
// Helper phiên đăng nhập admin. require_once ở đầu mọi trang/API chỉ dành cho admin.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function current_admin_id(): ?int
{
    return $_SESSION['admin_id'] ?? null;
}

// Dùng trong admin.php: chưa đăng nhập thì đẩy về trang đăng nhập.
function require_admin_page(string $loginUrl = 'login.php'): void
{
    if (!current_admin_id()) {
        header('Location: ' . $loginUrl);
        exit;
    }
}

// Dùng trong api/admin/*.php: chưa đăng nhập thì trả lỗi JSON 401 thay vì redirect.
function require_admin_api(): void
{
    if (!current_admin_id()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Chưa đăng nhập quản trị'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
