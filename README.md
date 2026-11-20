# Smart Campus TDTU – Bản đồ & dẫn đường khuôn viên

Website bản đồ khuôn viên Trường Đại học Tôn Đức Thắng (cơ sở Tân Phong): tìm địa điểm/phòng,
dẫn đường đi bộ bằng GPS hoặc mã QR, xem chi tiết tòa nhà theo tầng, và trang quản trị để cập nhật
dữ liệu mà không cần sửa code.

**Công nghệ:** PHP 8 + MySQL/MariaDB (XAMPP), Leaflet 1.9, dữ liệu OpenStreetMap, JavaScript thuần
(không cần build), test bằng `node --test`.

---

## 1. Tính năng

| Người dùng | Tính năng |
|---|---|
| **Khách** (không đăng nhập) | Bản đồ OSM thật, tìm địa điểm có/không dấu + bí danh, tìm phòng (vd `A0007`), dẫn đường đi bộ ngắn nhất, chỉ dẫn từng bước + giọng nói, GPS lọc nhiễu, “Tránh bậc thang”, xem chi tiết tòa nhà theo tầng |
| **Sinh viên** (tuỳ chọn) | Tất cả của khách + địa điểm yêu thích, lịch sử tìm kiếm/lộ trình, hồ sơ, đổi mật khẩu |
| **Quản trị viên** | Xem mục 6 |

Dẫn đường:
- Đồ thị đường lấy từ database (`road_nodes`/`road_edges`, admin sửa được); dự phòng bằng dữ liệu OSM.
- A* với heuristic hợp lệ → luôn ra tuyến ngắn nhất; tự chọn **lối vào** tòa nhà cho tuyến ngắn nhất.
- Không đi xuyên tòa nhà/hàng rào, không đi xuống hầm xe; đoạn cuối thiếu dữ liệu được vẽ nét đứt và cảnh báo.
- Chỉ tính lại tuyến khi thật sự đi lệch (ngưỡng nới theo sai số GPS), quãng còn lại tính dọc tuyến.
- Mã QR điểm mốc: `navigation.php?start=cong-1` → điểm xuất phát chính xác, không cần GPS.

## 2. Cài đặt trên máy (XAMPP)

1. Cài [XAMPP](https://www.apachefriends.org) (PHP 8.x). Bật **Apache** và **MySQL**.
2. Copy thư mục project vào `C:\xampp\htdocs\CK` (tên thư mục tuỳ ý – mọi đường dẫn đều tương đối).
3. Tạo database và nạp dữ liệu (chỉ làm 1 lần):
   ```bash
   "C:\xampp\mysql\bin\mysql.exe" -uroot -e "CREATE DATABASE IF NOT EXISTS smart_campus_tdtu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   "C:\xampp\mysql\bin\mysql.exe" -uroot smart_campus_tdtu < database/smart_campus_tdtu.sql
   ```
   Hoặc dùng phpMyAdmin: tạo database `smart_campus_tdtu` → tab **Import** → chọn `database/smart_campus_tdtu.sql`.
4. Mở **http://localhost/CK/** (không mở bằng `file:///` – PHP sẽ không chạy và bản đồ OSM sẽ bị chặn).
5. Đăng nhập quản trị demo: `admin` / `admin` → **đổi mật khẩu ngay** ở mục *Tài khoản của tôi*.

Máy dùng mật khẩu MySQL khác hoặc tên database khác: copy `config/config.example.php` thành
`config/config.local.php` và sửa (file này không bị commit).

## 3. Bản đồ OSM cho mọi máy – không lưu ảnh cứng

- **Nền bản đồ:** tile tải trực tiếp từ `tile.openstreetmap.org`. Service worker (`sw.js`) tự cache tile đã xem
  → mở lại hoặc mất mạng tạm thời vẫn có bản đồ. Repo không còn thư mục `tiles/`.
- **Dữ liệu đường/tòa nhà OSM:** `api/osm-campus.php` gọi Overpass **từ server**, cache 7 ngày trong `cache/`,
  khi lỗi thì dùng `data/campus-osm.snapshot.json` (có sẵn trong repo) → máy nào tải code về cũng chạy được,
  không phụ thuộc Overpass công cộng hay bị chặn CORS.
- Cập nhật snapshot: xoá `cache/campus-osm.json`, mở `api/osm-campus.php` khi có mạng, rồi copy file cache đè lên snapshot.

## 4. GPS – vì sao sai số cao và cách xử lý

- **Laptop không có chip GPS**: trình duyệt định vị qua Wi-Fi/IP nên sai 50–2000 m. Web tự nhận ra
  (“thiết bị có vẻ không có GPS”) và gợi ý chọn điểm đầu thủ công hoặc quét mã QR. Demo GPS thật bằng **điện thoại**.
- GPS chỉ chạy trên **HTTPS** hoặc `localhost` (web báo rõ nếu không đủ điều kiện).
- Bộ lọc `js/lib/gps-filter.js`: chờ tín hiệu tốt tối đa 10 giây khi khởi động, loại bước nhảy vô lý
  (> tốc độ đi bộ + sai số), làm mượt Kalman; khi đang dẫn đường, chấm vị trí được “dính” vào tuyến
  nếu lệch ít hơn sai số.
- Mẹo cho người dùng: bật “Vị trí chính xác” (Android) / “Precise Location” (iOS), đứng nơi thoáng.

## 5. Đưa lên hosting miễn phí (và gắn tên miền sau)

Cần hosting có **PHP 8 + MySQL + SSL miễn phí** (vd InfinityFree, AwardSpace… – kiểm tra hạn mức của từng nơi).
Ví dụ với InfinityFree:

1. Tạo tài khoản → **Create Account** → chọn subdomain miễn phí (vd `tdtu-map.free.nf`).
2. **MySQL Databases** → tạo database, ghi lại *host, tên DB, user, mật khẩu*.
3. **phpMyAdmin** → chọn database vừa tạo → **Import** `database/smart_campus_tdtu.sql`.
4. Copy `config/config.example.php` → `config/config.local.php`, điền thông tin ở bước 2,
   để `'osm_live_fetch' => false` (hosting miễn phí thường chặn gọi API ra ngoài – web dùng snapshot có sẵn).
5. Upload toàn bộ project (trừ `.git`, `tests`, `.github`) vào thư mục `htdocs/` bằng **File Manager** hoặc FTP (FileZilla).
6. Bật **SSL** miễn phí trong control panel (bắt buộc để GPS chạy trên điện thoại), mở `https://<subdomain>/`.
7. Đăng nhập `admin`/`admin` → đổi mật khẩu ngay.

**Gắn tên miền riêng sau này:** mua tên miền → trong hosting chọn *Addon Domain* → trỏ nameserver của tên miền
về hosting → bật SSL cho tên miền mới. **Không cần sửa code** (mọi link là tương đối, cookie phiên tự theo tên miền).

## 6. Quản trị viên chỉnh sửa được gì (`admin.php`)

| Mục | Admin làm được | Ảnh hưởng tới người dùng |
|---|---|---|
| **Tổng quan** | Xem số địa điểm/tòa/phòng/lối vào/đoạn đường/tài khoản; biểu đồ tìm kiếm & dẫn đường 14 ngày; điểm đến hot; **từ khoá tìm không ra kết quả** | Biết cần bổ sung địa điểm/bí danh nào |
| **Địa điểm** | Thêm, sửa tên, mã, danh mục, nhãn hiển thị, **bí danh tìm kiếm**, mô tả, **ảnh bằng link Google Drive** (có xem trước), trạng thái (hoạt động/bảo trì/đóng cửa), **kéo thả toạ độ trên bản đồ**; ẩn/hiện; **in mã QR** điểm xuất phát | Tên, nhãn, kết quả tìm kiếm, điểm đến, ảnh cập nhật ngay |
| **Lối vào** | Bấm bản đồ để thêm, kéo để dời, đổi loại (cửa chính/phụ/cổng/lối xe), xoá | Router dẫn tới đúng cửa gần nhất theo tuyến |
| **Tầng & Phòng** | Đánh dấu địa điểm là tòa nhà; thêm/sửa/xoá tầng (số tầng, tên, trạng thái); **sơ đồ tầng: tải file .svg hoặc dán link ảnh Google Drive**; **ghim phòng lên sơ đồ** (chọn phòng → bấm vị trí); thêm/sửa/xoá phòng (mã, tên, loại, sức chứa, đơn vị, trạng thái) | Trang chi tiết tòa nhà hiện sơ đồ + ghim, tìm phòng sẽ tô đỏ đúng ghim |
| **Đường đi** | **Vẽ lối đi mới** (bấm 2 điểm), bật/tắt đoạn (vd đang sửa chữa), đổi loại (bậc thang để chế độ “tránh bậc thang” bỏ qua), xoá | Tuyến dẫn đường thay đổi ngay |
| **Danh mục** | Thêm danh mục, đổi tên/màu/thứ tự | Nhóm địa điểm |
| **Tài khoản sinh viên** | Xem danh sách, khoá/mở khoá, đặt lại mật khẩu, xoá | – |
| **Nhật ký thay đổi** | Xem ai sửa gì, lúc nào, dữ liệu trước/sau | Truy vết, khôi phục thủ công |
| **Tài khoản của tôi** | Đổi mật khẩu admin (cảnh báo nếu vẫn là `admin`) | Bảo mật |

Admin **không** chỉnh được: nền bản đồ OSM (do cộng đồng OpenStreetMap quản lý) và mã nguồn.

### Dùng ảnh từ Google Drive (không cần upload lên hosting)

1. Đưa ảnh (ảnh tòa nhà, ảnh/PNG sơ đồ tầng) lên Google Drive.
2. Chuột phải file → **Chia sẻ** → *Quyền truy cập chung*: **Bất kỳ ai có đường liên kết** (Người xem) → **Sao chép đường liên kết**.
3. Dán link (dạng `https://drive.google.com/file/d/…/view?usp=sharing`) vào ô ảnh trong trang Quản trị.
   Web tự đổi sang link hiển thị ảnh và cho xem trước. Link **thư mục** Drive sẽ bị từ chối – phải là link của 1 file.
4. Nếu ảnh không hiện: kiểm tra lại bước 2 (file đang để chế độ “Hạn chế” thì người ngoài không xem được).

Sơ đồ tầng dạng **.svg** được tải thẳng từ máy lên và lưu trong database (không tạo file trên hosting);
trước khi lưu, file được làm sạch: chỉ giữ hình vẽ, xoá script/sự kiện/liên kết ngoài.

## 7. Cấu trúc thư mục

```
api/            API JSON công khai (places, search, rooms, road-graph, osm-campus, log, user/*)
api/admin/      API quản trị (bắt buộc phiên admin + CSRF, ghi audit_logs)
config/         config.php (+ config.local.php), db.php, auth.php (session, CSRF, chống dò mật khẩu)
includes/       user-menu.php, admin-helpers.php
js/lib/         Logic thuần có test: walk-router, route-tracker, gps-filter, place-search, resolve-place...
js/             Code từng trang: navigation, campus-map, admin, profile, login, building-details
data/           Snapshot OSM khuôn viên
database/       smart_campus_tdtu.sql (file database đầy đủ duy nhất), script xuất/đồng bộ dữ liệu
tests/          node --test (unit + tích hợp API)
sw.js, manifest.webmanifest   PWA
```

## 8. Kiểm thử

```bash
node --test tests/*.test.js
```

Test tích hợp với PHP + MySQL thật (dùng database thử nghiệm, không dùng dữ liệu thật):

```bash
php -S 127.0.0.1:8099 -t .
```

```bash
SC_API_BASE=http://127.0.0.1:8099 node --test tests/api.integration.test.js
```

GitHub Actions (`.github/workflows/ci.yml`) tự chạy kiểm tra cú pháp PHP, unit test và test tích hợp
trên MariaDB mỗi lần push. `tests/repo-hygiene.test.js` chặn việc commit file còn marker xung đột merge.

## 9. Bảo mật đã áp dụng

Mật khẩu `password_hash`; session `HttpOnly` + `SameSite=Lax` (+ `Secure` khi HTTPS); CSRF token cho mọi
request ghi; giới hạn 5 lần đăng nhập sai/10 phút; prepared statement cho mọi truy vấn; escape HTML khi hiển
thị; sơ đồ SVG được làm sạch theo whitelist khi lưu (chống XSS/XXE) và hiển thị qua `<img>` nên không chạy script;
link ảnh chỉ nhận Google Drive hoặc https; toạ độ admin nhập bị giới hạn trong khuôn viên;
vị trí xuất phát trong log được làm tròn ~11 m.

## 10. Bản quyền dữ liệu

Dữ liệu bản đồ © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), giấy phép ODbL.
Tile bản đồ dùng theo [chính sách sử dụng tile của OSM](https://operations.osmfoundation.org/policies/tiles/)
(phù hợp quy mô đồ án; triển khai lớn nên dùng nhà cung cấp tile riêng).
