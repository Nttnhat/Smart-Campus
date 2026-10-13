// Chạy 1 lần (CLI): tải sẵn tile OpenStreetMap vùng khuôn viên TDTU về thư mục tiles/
// để web không phụ thuộc tải tile trực tiếp từ Internet mỗi lần (máy khác bị chặn/lỗi cert
// vẫn xem được bản đồ nền vì tile đã có sẵn trong project, phục vụ qua Apache như file tĩnh).
// Vùng tải khớp với CAMPUS_BOUNDS trong js/tdtu-vector-map.js, có đệm thêm biên.
const fs = require('fs');
const path = require('path');
const https = require('https');

const BOUNDS = { south: 10.7278, west: 106.6930, north: 10.7375, east: 106.7050 };
const ZOOMS = [15, 16, 17, 18, 19];
const OUT_DIR = path.join(__dirname, '..', 'tiles');
const DELAY_MS = 150; // lịch sự với OSM tile server, không tải dồn dập

function lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
function lat2tile(lat, z) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function downloadTile(z, x, y) {
  return new Promise((resolve, reject) => {
    const dir = path.join(OUT_DIR, String(z), String(x));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${y}.png`);
    if (fs.existsSync(file)) return resolve('skip');
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    https.get(url, { headers: { 'User-Agent': 'TDTU-SmartCampus-TileCache/1.0 (du an sinh vien, tai 1 lan)' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} cho ${url}`)); }
      const ws = fs.createWriteStream(file);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve('ok')));
      ws.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  let total = 0, ok = 0, skip = 0, fail = 0;
  for (const z of ZOOMS) {
    const x1 = lon2tile(BOUNDS.west, z), x2 = lon2tile(BOUNDS.east, z);
    const y1 = lat2tile(BOUNDS.north, z), y2 = lat2tile(BOUNDS.south, z);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        total++;
        try {
          const result = await downloadTile(z, x, y);
          if (result === 'ok') { ok++; await sleep(DELAY_MS); }
          else skip++;
        } catch (e) {
          fail++;
          console.warn(`Lỗi tải z${z}/${x}/${y}: ${e.message}`);
        }
      }
    }
    console.log(`Xong zoom ${z}. Tổng tới giờ: ${total}, mới tải: ${ok}, đã có sẵn: ${skip}, lỗi: ${fail}`);
  }
  console.log(`Hoàn tất. Tổng ${total} tile, tải mới ${ok}, bỏ qua (đã có) ${skip}, lỗi ${fail}.`);
})();
