<?php
// Cấu hình theo môi trường. Thứ tự ưu tiên: config/config.local.php > biến môi trường > mặc định XAMPP.
// - Máy cá nhân (XAMPP): không cần làm gì, mặc định root / không mật khẩu / smart_campus_tdtu.
// - Hosting miễn phí: copy config.example.php thành config.local.php rồi điền thông tin hosting cấp.
//   config.local.php nằm trong .gitignore nên mật khẩu không bị đẩy lên GitHub.
function app_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $config = [
        'db_host' => getenv('DB_HOST') ?: '127.0.0.1',
        'db_port' => getenv('DB_PORT') ?: '3306',
        'db_name' => getenv('DB_NAME') ?: 'smart_campus_tdtu',
        'db_user' => getenv('DB_USER') ?: 'root',
        'db_pass' => getenv('DB_PASS') ?: '',
        // Hosting miễn phí thường chặn kết nối ra ngoài -> false để chỉ dùng dữ liệu OSM đã lưu sẵn.
        'osm_live_fetch' => true,
        'debug' => false,
    ];
    $local = __DIR__ . '/config.local.php';
    if (is_file($local)) {
        $override = require $local;
        if (is_array($override)) {
            $config = array_merge($config, $override);
        }
    }
    return $config;
}
