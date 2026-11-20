<?php
// Copy file này thành config/config.local.php và sửa giá trị cho đúng máy/hosting.
// File config.local.php KHÔNG được commit (đã có trong .gitignore).
return [
    'db_host' => 'sqlXXX.infinityfree.com', // hosting ghi trong mục "MySQL Databases"
    'db_port' => '3306',
    'db_name' => 'if0_XXXXXXX_smart_campus',
    'db_user' => 'if0_XXXXXXX',
    'db_pass' => 'mat-khau-hosting',
    // Hosting chặn gọi API ngoài thì để false: bản đồ dùng dữ liệu OSM đã lưu trong data/.
    'osm_live_fetch' => false,
    'debug' => false,
];
