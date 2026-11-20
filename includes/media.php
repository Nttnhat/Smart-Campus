<?php
// Chuẩn hoá link ảnh (địa điểm, sơ đồ tầng). Bản PHP của js/lib/drive-link.js - giữ 2 bên giống nhau.
// Trả ['ok' => bool, 'url' => string, 'driveId' => ?string] hoặc ['ok' => false, 'error' => string].
function normalize_image_url($input): array
{
    $url = trim((string) $input);
    if ($url === '') {
        return ['ok' => true, 'url' => '', 'driveId' => null];
    }
    if (preg_match('#^https://drive\.google\.com/drive/(?:u/\d+/)?folders/#', $url)) {
        return ['ok' => false, 'error' => 'Đây là link thư mục Drive. Hãy mở ảnh rồi chọn Chia sẻ → Sao chép đường liên kết của 1 file.'];
    }
    $id = '([A-Za-z0-9_-]{20,})';
    $patterns = [
        "#^https://(?:drive|docs)\\.google\\.com/file/d/$id#",
        "#^https://(?:drive|docs)\\.google\\.com/(?:open|uc|thumbnail)\\?(?:[^\\#]*&)?id=$id#",
        "#^https://lh3\\.googleusercontent\\.com/d/$id#",
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $url, $m)) {
            return ['ok' => true, 'url' => 'https://drive.google.com/thumbnail?id=' . $m[1] . '&sz=w1600', 'driveId' => $m[1]];
        }
    }
    if (strlen($url) <= 500 && preg_match('#^https://[^\s"\'<>]+$#i', $url)) {
        return ['ok' => true, 'url' => $url, 'driveId' => null];
    }
    return ['ok' => false, 'error' => 'Link ảnh phải là link Google Drive hoặc link https:// tới file ảnh.'];
}

// Ảnh dùng được để hiển thị: link https (đã chuẩn hoá) hoặc file có thật trong project.
function displayable_image(?string $url, string $root): ?string
{
    if (!$url) {
        return null;
    }
    if (stripos($url, 'https://') === 0) {
        return $url;
    }
    return preg_match('#^[\w/\-.]+$#', $url) && strpos($url, '..') === false && is_file($root . '/' . $url) ? $url : null;
}
