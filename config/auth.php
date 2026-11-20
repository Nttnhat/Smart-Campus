<?php
// Phiên đăng nhập cho 2 vai trò:
// - admin  ($_SESSION['admin_id'], bảng admins): quản trị dữ liệu.
// - user   ($_SESSION['user_id'],  bảng users) : sinh viên, KHÔNG bắt buộc. Khách vẫn dùng bản đồ,
//   tìm kiếm, dẫn đường bình thường; đăng nhập chỉ thêm yêu thích, lịch sử, hồ sơ.
if (session_status() === PHP_SESSION_NONE) {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function current_admin_id(): ?int
{
    return isset($_SESSION['admin_id']) ? (int) $_SESSION['admin_id'] : null;
}

function current_user_id(): ?int
{
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function current_user_name(): ?string
{
    return $_SESSION['user_name'] ?? null;
}

// Dùng trong admin.php: chưa đăng nhập thì đẩy về trang đăng nhập.
function require_admin_page(string $loginUrl = 'login.php?role=admin'): void
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
        auth_json_error('Chưa đăng nhập quản trị', 401);
    }
    require_csrf();
}

function require_user_api(): void
{
    if (!current_user_id()) {
        auth_json_error('Cần đăng nhập tài khoản sinh viên', 401);
    }
    require_csrf();
}

function auth_json_error(string $message, int $status): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- CSRF: token theo phiên, gửi qua header X-CSRF-Token (js/api.js tự gắn) hoặc field csrf_token.
function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

// In trong <head> của mọi trang: CSRF token + manifest PWA + màu thanh trình duyệt điện thoại.
function csrf_meta(): string
{
    return '<meta name="csrf-token" content="' . htmlspecialchars(csrf_token(), ENT_QUOTES) . '">'
        . "\n    <link rel=\"manifest\" href=\"manifest.webmanifest\">"
        . "\n    <meta name=\"theme-color\" content=\"#D31145\">";
}

// Chỉ kiểm tra với request thay đổi dữ liệu (POST/PUT/PATCH/DELETE); GET luôn an toàn.
function require_csrf(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (!is_string($sent) || !hash_equals(csrf_token(), $sent)) {
        auth_json_error('Phiên làm việc đã hết hạn, hãy tải lại trang', 419);
    }
}

// ---- Chống dò mật khẩu: tối đa 5 lần sai / 10 phút / phiên + IP.
function login_throttle_key(string $scope): string
{
    return 'login_fail_' . $scope . '_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
}

function login_is_throttled(string $scope): bool
{
    $entry = $_SESSION[login_throttle_key($scope)] ?? null;
    return $entry && $entry['count'] >= 5 && time() - $entry['first'] < 600;
}

function login_record_failure(string $scope): void
{
    $key = login_throttle_key($scope);
    $entry = $_SESSION[$key] ?? null;
    if (!$entry || time() - $entry['first'] >= 600) {
        $entry = ['count' => 0, 'first' => time()];
    }
    $entry['count']++;
    $_SESSION[$key] = $entry;
}

function login_clear_failures(string $scope): void
{
    unset($_SESSION[login_throttle_key($scope)]);
}
