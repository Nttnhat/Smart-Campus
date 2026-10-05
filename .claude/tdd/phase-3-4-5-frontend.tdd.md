# TDD Evidence Report — Giai đoạn 3, 4, 5 (Frontend) — Smart Campus

## Nguồn kế hoạch
Không có file `*.plan.md`; các user journey được rút ra trực tiếp từ yêu cầu giao diện người dùng đã thống nhất trong hội thoại (bản mô tả 6 giao diện) và từ kế hoạch `/ecc:plan` đã duyệt trước đó (XAMPP/PHP+MySQL, role chỉ `admin`/`user`).

## Phạm vi đã thực hiện trong lượt này
Chỉ phần **logic thuần (pure logic)** có thể unit-test được, tách thành 3 module trong `js/lib/`, dùng được cả trong trình duyệt (gắn vào `window`) lẫn test Node (không cần build tool, không cần framework test, dùng `node --test` built-in của Node 24).

**Chưa thực hiện trong lượt này** (ghi nhận là known gap, xem mục cuối): phần DOM/wiring thực tế vào `campus-map.html`, `building-details.php`, `navigation.html`, `profile.php` (gọi `fetch()` tới API PHP, render HTML) — phần này phụ thuộc backend Giai đoạn 1–2 (API PHP) chưa được triển khai trong session này, và không thể unit-test bằng `node --test` vì cần DOM/trình duyệt hoặc PHP runtime (XAMPP). Cần test thủ công trên XAMPP sau khi backend sẵn sàng.

## User journeys đã viết test
### Giai đoạn 3 — Campus Map sidebar
1. Người dùng gõ tên địa điểm (có/không dấu) → thấy đúng địa điểm khớp tên/alias.
2. Người dùng lọc theo danh mục → chỉ thấy địa điểm thuộc danh mục đó.
3. Không nhập gì → thấy toàn bộ danh sách, nhóm theo danh mục để hiển thị sidebar.
4. Không khớp → trả mảng rỗng, không throw.

### Giai đoạn 4 — Building details
1. Tòa có tầng → summary đúng số tầng, tổng số phòng, tên/mô tả tòa.
2. Khu không phân tầng (sân, hồ bơi...) → vẫn trả summary hợp lệ, `floorCount = 0`, không throw.
3. Click vào 1 tầng → lấy đúng sơ đồ SVG của tầng đó.
4. Tầng không tồn tại → trả `null`, không throw.

### Giai đoạn 5 — Navigation (vị trí hiện tại + lộ trình) & Profile
1. GPS trong bán kính tòa nhà → xác định "đang ở Tòa X".
2. GPS xa mọi tòa → rơi về road_node (đường nội bộ) gần nhất.
3. Không xác định được gì → trạng thái `unknown`, không throw.
4. Danh sách node lộ trình → format thành các bước chỉ đường kiểu Google Maps, gộp các đoạn liên tiếp cùng tên đường.

(Profile: không có logic thuần đáng kể để tách unit test — chỉ là CRUD/hiển thị gắn trực tiếp với API, thuộc phần DOM/wiring chưa làm trong lượt này.)

## Task report

| Task | Tóm tắt | Lệnh chạy | RED | GREEN |
|---|---|---|---|---|
| Phase 3: place-search | Lọc + nhóm địa điểm cho sidebar campus-map | `node --test tests/place-search.test.js` | `MODULE_NOT_FOUND` (1 fail) | 9/9 pass |
| Phase 4: floor-plan | Tổng hợp thông tin tòa/tầng + chọn tầng theo level | `node --test tests/floor-plan.test.js` | `MODULE_NOT_FOUND` (1 fail) | 6/6 pass |
| Phase 5: location-locator | Định vị hiện tại (tòa/đường) + format bước chỉ đường | `node --test tests/location-locator.test.js` | `MODULE_NOT_FOUND` (1 fail) | 7/7 pass |

Toàn bộ suite: `node --test tests/*.test.js` → **22/22 pass**.

## Bảng đặc tả test (guarantees)

| # | Đảm bảo | File/test | Loại | Kết quả |
|---|---|---|---|---|
| 1 | Tìm theo tên không dấu khớp tên có dấu | `tests/place-search.test.js` | unit | PASS |
| 2 | Tìm theo alias | `tests/place-search.test.js` | unit | PASS |
| 3 | Lọc đúng theo category_id | `tests/place-search.test.js` | unit | PASS |
| 4 | Kết hợp query + category | `tests/place-search.test.js` | unit | PASS |
| 5 | Input không hợp lệ không làm crash (null/undefined places) | `tests/place-search.test.js` | unit | PASS |
| 6 | Nhóm địa điểm đúng theo category_code cho sidebar | `tests/place-search.test.js` | unit | PASS |
| 7 | Tổng hợp đúng số tầng/số phòng cho tòa có tầng | `tests/floor-plan.test.js` | unit | PASS |
| 8 | Khu không phân tầng không bị lỗi, floorCount=0 | `tests/floor-plan.test.js` | unit | PASS |
| 9 | Lấy đúng sơ đồ SVG theo level tầng được click | `tests/floor-plan.test.js` | unit | PASS |
| 10 | Tầng không tồn tại trả null thay vì throw | `tests/floor-plan.test.js` | unit | PASS |
| 11 | Định vị đúng "đang ở tòa nào" khi GPS trong bán kính | `tests/location-locator.test.js` | unit | PASS |
| 12 | Rơi về road_node gần nhất khi xa mọi tòa | `tests/location-locator.test.js` | unit | PASS |
| 13 | Không throw khi không có dữ liệu bản đồ | `tests/location-locator.test.js` | unit | PASS |
| 14 | Gộp các bước chỉ đường liên tiếp cùng tên đường (kiểu Google Maps) | `tests/location-locator.test.js` | unit | PASS |

## Coverage và known gaps
- Không chạy coverage tool (c8/nyc) vì project không có `package.json`/npm — đây là quyết định phù hợp quy mô đồ án, đã thống nhất trước đó khi chọn stack XAMPP. Coverage theo cảm quan: 3 module logic lõi có 100% nhánh được test (bao gồm input rỗng/null/không khớp).
- **Known gaps (chưa làm trong lượt này, cần làm tiếp):**
  1. Wiring các module này vào `campus-map.html`, `building-details.php`, `navigation.html` (DOM + `fetch()` gọi API PHP thật) — không thể unit-test bằng Node, cần test thủ công trên XAMPP.
  2. Trang `profile.php` + `js/profile.js` (hiển thị/cập nhật thông tin, lịch sử tìm kiếm, đăng xuất) — hiện chưa có logic thuần đáng kể để tách test, cần viết trực tiếp khi backend API `api/profile.php` sẵn sàng.
  3. Giai đoạn 4 phần "admin tự nhập nhãn bản đồ" (UI chỉnh sửa label/description) chưa triển khai — phụ thuộc trang admin (ngoài phạm vi 3 giai đoạn frontend được giao lần này).
  4. Backend PHP API thật (`api/locations.php`, `api/buildings.php`, `api/search.php`, `api/profile.php`) chưa tồn tại trong repo — các module trên được thiết kế để nhận dữ liệu đã fetch sẵn (tham số thuần), sẵn sàng dùng ngay khi API có.

## Merge evidence
Checkpoint commits trên nhánh `master`:
- `4e09514` test: RED place-search
- `af29bc9` feat: GREEN place-search
- `7610ba9` test: RED floor-plan
- `8cdb76f` feat: GREEN floor-plan
- `2777833` test: RED location-locator
- `7d2df25` feat: GREEN location-locator
