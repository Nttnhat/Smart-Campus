<?php
// Dữ liệu OpenStreetMap của khuôn viên (đường, tòa nhà, hàng rào, ranh giới trường) cho MỌI máy,
// không cần lưu ảnh và không để trình duyệt gọi Overpass trực tiếp (hay bị chặn CORS/504).
// Thứ tự: cache/ còn hạn (7 ngày) -> gọi Overpass từ server (nếu osm_live_fetch) -> cache cũ ->
//         data/campus-osm.snapshot.json (commit sẵn trong repo, luôn có).
// Header X-Data-Source cho biết dữ liệu lấy từ đâu (cache | live | stale-cache | snapshot).
require_once __DIR__ . '/../config/config.php';

const OSM_TTL = 7 * 24 * 3600;
const BBOX = '10.7288,106.6940,10.7365,106.7040';
$cacheFile = __DIR__ . '/../cache/campus-osm.json';
$snapshotFile = __DIR__ . '/../data/campus-osm.snapshot.json';

function send_json_file(string $file, string $source): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    header('X-Data-Source: ' . $source);
    readfile($file);
    exit;
}

function fetch_overpass(): ?string
{
    $b = BBOX;
    $query = "[out:json][timeout:25];("
        . "way[\"highway\"~\"^(footway|path|pedestrian|service|living_street|residential|unclassified|steps|corridor)$\"]($b);"
        . "way[\"building\"]($b);way[\"natural\"=\"water\"]($b);way[\"waterway\"]($b);"
        . "way[\"barrier\"~\"^(fence|wall)$\"]($b);way[\"amenity\"=\"university\"]($b););out geom tags;";
    $endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
    foreach ($endpoints as $endpoint) {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'timeout' => 30,
            'ignore_errors' => true,
            'header' => "Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: SmartCampus-StudentProject/1.0\r\n",
            'content' => 'data=' . urlencode($query),
        ]]);
        $body = @file_get_contents($endpoint, false, $context);
        if ($body === false) {
            continue;
        }
        $decoded = json_decode($body, true);
        if (is_array($decoded) && !empty($decoded['elements'])) {
            return $body;
        }
    }
    return null;
}

if (is_file($cacheFile) && time() - filemtime($cacheFile) < OSM_TTL) {
    send_json_file($cacheFile, 'cache');
}

if (!empty(app_config()['osm_live_fetch'])) {
    $body = fetch_overpass();
    if ($body !== null) {
        if (!is_dir(dirname($cacheFile))) {
            @mkdir(dirname($cacheFile), 0775, true);
        }
        if (@file_put_contents($cacheFile, $body) !== false) {
            send_json_file($cacheFile, 'live');
        }
        header('Content-Type: application/json; charset=utf-8');
        header('X-Data-Source: live');
        echo $body;
        exit;
    }
}

if (is_file($cacheFile)) {
    send_json_file($cacheFile, 'stale-cache');
}
if (is_file($snapshotFile)) {
    send_json_file($snapshotFile, 'snapshot');
}

http_response_code(503);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['error' => 'Chưa có dữ liệu OSM (thiếu data/campus-osm.snapshot.json)'], JSON_UNESCAPED_UNICODE);
