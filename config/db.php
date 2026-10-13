<?php
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=127.0.0.1;dbname=smart_campus_tdtu;charset=utf8mb4',
                'root',
                '',
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'error' => 'Không kết nối được database smart_campus_tdtu.',
                'fix' => 'Kiểm tra: (1) MySQL trong XAMPP đã bật chưa, (2) database "smart_campus_tdtu" đã import từ database/smart_campus_tdtu.sql chưa, (3) user/mật khẩu MySQL root trong config/db.php có khớp máy này không.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    return $pdo;
}
