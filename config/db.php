<?php
require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = app_config();
        try {
            $pdo = new PDO(
                "mysql:host={$c['db_host']};port={$c['db_port']};dbname={$c['db_name']};charset=utf8mb4",
                $c['db_user'],
                $c['db_pass'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'error' => 'Không kết nối được database ' . $c['db_name'] . '.',
                'fix' => 'Kiểm tra: (1) MySQL đã bật chưa, (2) đã import database/smart_campus_tdtu.sql chưa, (3) thông tin trong config/config.local.php (hoặc mặc định root/không mật khẩu) có đúng không.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    return $pdo;
}

// Trả JSON và dừng. Dùng chung cho mọi file trong api/.
function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void
{
    json_out(['error' => $message], $status);
}

// Đọc body: hỗ trợ cả form (URLSearchParams) lẫn JSON.
function request_data(): array
{
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== false) {
        $decoded = json_decode(file_get_contents('php://input'), true);
        return is_array($decoded) ? $decoded : [];
    }
    return $_POST;
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        json_error('Phương thức không được hỗ trợ', 405);
    }
}
