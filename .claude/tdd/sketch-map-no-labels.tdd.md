# TDD Evidence Report — Chuyển bản đồ sang kiểu Sketch, bỏ toàn bộ nhãn

## Nguồn kế hoạch
Không có `*.plan.md`. Yêu cầu ban đầu của user: "đổi map từ Leaflet sang Google Maps chính thức". Sau khi được hỏi về Google Maps API key (bắt buộc, cần billing), user đổi hướng: **giữ Leaflet, nhưng bỏ hết nhãn chữ (kể cả nhãn TDTU vừa thêm trước đó), chỉ vẽ phác thảo (sketch) khung đường/tòa nhà, giới hạn trong khuôn viên TDTU**.

## User journeys
1. Đối tượng OSM có tag `building` → phân loại `building`, vẽ polygon kiểu sketch (viền nét đứt, fill nhạt).
2. Đối tượng `natural=water`/`waterway` → phân loại `water`.
3. `highway` thuộc nhóm đi bộ (footway/path/pedestrian/steps) → phân loại `pedestrian`.
4. `highway` thuộc nhóm đường xe/nội bộ (service/residential/unclassified/tertiary) → phân loại `road`.
5. Tag không liên quan (tourism, shop ngoài campus...) → phân loại `ignore`, không vẽ.
6. Mỗi phân loại có 1 style sketch riêng (màu/nét), **không có `label`/`tooltip` nào gắn trong style**.
7. Đối tượng nằm ngoài bounds khuôn viên TDTU (vd: tòa nhà Mapletree Business Centre xa trường) → bị cắt bỏ, không vẽ.

## Task report

| Task | Tóm tắt | Lệnh chạy | RED | GREEN |
|---|---|---|---|---|
| sketch-map module | Phân loại + style sketch + cắt bounds campus | `node --test tests/sketch-map.test.js` | `MODULE_NOT_FOUND` (1 fail) | 10/10 pass (sau khi sửa 1 test có dữ liệu mẫu sai — điểm Mapletree thực ra vẫn nằm trong bounds hình chữ nhật) |

Toàn bộ suite: `node --test tests/*.test.js` → **32/32 pass**.

## Bảng đặc tả test

| # | Đảm bảo | Loại | Kết quả |
|---|---|---|---|
| 1 | building -> 'building' | unit | PASS |
| 2 | natural=water/waterway -> 'water' | unit | PASS |
| 3 | highway đi bộ -> 'pedestrian' | unit | PASS |
| 4 | highway xe/nội bộ -> 'road' | unit | PASS |
| 5 | tag không liên quan -> 'ignore' | unit | PASS |
| 6 | style sketch không chứa label/tooltip | unit | PASS |
| 7 | classification không xác định -> style null | unit | PASS |
| 8 | điểm trong bounds campus -> true | unit | PASS |
| 9 | điểm ngoài bounds campus -> false | unit | PASS |
| 10 | toạ độ NaN/undefined -> false, không throw | unit | PASS |

## Wiring vào giao diện thật (không unit-test được bằng Node, cần DOM/mạng)
- `js/tdtu-vector-map.js`: thêm `drawSketchBasemap(map)` - gọi Overpass, lọc theo `isWithinCampus`, phân loại bằng `classifyMapFeature`, vẽ bằng `sketchStyleFor`, không gọi `bindTooltip`/`bindPopup` nào.
- `createBaseMap()`: bỏ `L.tileLayer(...)` (nguồn gốc mọi chữ baked-in từ OSM), thay bằng nền màu giấy phác thảo (#f6f3ea) + `L.control.attribution` tối giản.
- `campus-map.js`, `navigation.js`: đổi `VM.drawCampusVectors()` -> `VM.drawSketchBasemap()`; xoá hoàn toàn lời gọi `VM.drawOfficialLabels()`/`VM.drawNativeMapLabels()`.
- `campus-map.html`, `navigation.html`: thêm `<script src="js/lib/sketch-map.js">` trước `tdtu-vector-map.js`.

### Xác nhận trực quan (browser thật, qua node --test không với tới được)
- Test với dữ liệu Overpass giả lập (3 phần tử: building/footway/water) -> `drawSketchBasemap` trả count=3, source='sketch', cả 3 đều được vẽ đúng loại.
- Test với dữ liệu Overpass thật (766 phần tử trong khuôn viên TDTU) -> count=766, bản đồ hiển thị đầy đủ khung tòa nhà/đường/hồ nước dạng nét đứt, xác nhận bằng mắt: không có bất kỳ chữ/nhãn nào trên bản đồ (khác hẳn trước đây có cả nhãn TDTU và nhãn OSM).

## Coverage và known gaps
- Không chạy coverage tool (không có npm trong project, quyết định đã thống nhất từ trước).
- Known gaps:
  1. Overpass API công khai đôi khi chậm/504 (đã gặp trong lúc test) - ngoài tầm kiểm soát của code, cần cân nhắc cache dữ liệu về phía server PHP sau này (Giai đoạn 1-2) thay vì gọi trực tiếp từ trình duyệt mỗi lần tải trang.
  2. `drawCampusVectors`, `drawOfficialLabels`, `drawNativeMapLabels` vẫn còn trong `tdtu-vector-map.js` (không xoá, chỉ không gọi nữa) - có thể dọn dẹp sau nếu chắc chắn không cần quay lại chế độ có nhãn.
  3. Chưa kiểm thử trên XAMPP thật (chỉ test qua Python static server) - cần xác nhận lại khi có backend PHP đi kèm.

## Merge evidence
Checkpoint commits trên nhánh master:
- 8352f04 test: RED sketch-map
- 9d40f77 feat: GREEN sketch-map module
- (commit tiếp theo): wiring vào campus-map.js/navigation.js/tdtu-vector-map.js/HTML
