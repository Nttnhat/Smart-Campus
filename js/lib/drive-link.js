// Chuẩn hoá link ảnh cho admin (UMD -> window.DriveLink).
// Admin không upload ảnh lên hosting mà dán link Google Drive: link chia sẻ ".../file/d/<ID>/view"
// không hiển thị được trong <img>, nên đổi sang "thumbnail?id=<ID>&sz=w1600" (Drive trả ảnh trực tiếp).
// Điều kiện: file trên Drive phải chia sẻ "Bất kỳ ai có đường liên kết".
// Quy tắc này có bản PHP giống hệt trong includes/media.php (tests/php-media.test.js so sánh 2 bên).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DriveLink = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ID = '([A-Za-z0-9_-]{20,})';
  const DRIVE_PATTERNS = [
    new RegExp(`^https://(?:drive|docs)\\.google\\.com/file/d/${ID}`),
    new RegExp(`^https://(?:drive|docs)\\.google\\.com/(?:open|uc|thumbnail)\\?(?:[^#]*&)?id=${ID}`),
    new RegExp(`^https://lh3\\.googleusercontent\\.com/d/${ID}`),
  ];
  const FOLDER = /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//;

  function displayUrlForId(id) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  }

  function toDisplayUrl(input) {
    const url = String(input ?? '').trim();
    if (!url) return { ok: true, url: '', driveId: null };
    if (FOLDER.test(url)) {
      return { ok: false, error: 'Đây là link thư mục Drive. Hãy mở ảnh rồi chọn Chia sẻ → Sao chép đường liên kết của 1 file.' };
    }
    for (const pattern of DRIVE_PATTERNS) {
      const m = pattern.exec(url);
      if (m) return { ok: true, url: displayUrlForId(m[1]), driveId: m[1] };
    }
    if (url.length <= 500 && /^https:\/\/[^\s"'<>]+$/i.test(url)) return { ok: true, url, driveId: null };
    return { ok: false, error: 'Link ảnh phải là link Google Drive hoặc link https:// tới file ảnh.' };
  }

  return { toDisplayUrl, displayUrlForId };
});
