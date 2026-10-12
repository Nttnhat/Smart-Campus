<?php
// Chạy một lần sau khi import database: cột `places.name_search` vừa thêm (api/search.php và
// api/suggest.php cần cột này nhưng bản dump gốc không có). Script này điền giá trị bằng đúng hàm
// remove_diacritics() mà các API đang dùng để so khớp, tránh lệch logic giữa 2 nơi.
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/text.php';

$pdo = db();
$rows = $pdo->query('SELECT id, name FROM places')->fetchAll();
$update = $pdo->prepare('UPDATE places SET name_search = :ns WHERE id = :id');

$count = 0;
foreach ($rows as $row) {
    $update->execute([':ns' => remove_diacritics($row['name']), ':id' => $row['id']]);
    $count++;
}

echo "Đã cập nhật name_search cho {$count} địa điểm.\n";
