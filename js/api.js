// Helper gọi API PHP dùng chung cho mọi trang.
// - Tự gắn CSRF token (đọc từ <meta name="csrf-token"> do PHP in ra) cho request thay đổi dữ liệu.
// - Trả JSON; lỗi HTTP -> throw Error có .status và message tiếng Việt từ server.
(function (root) {
  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  }

  async function apiFetch(url, { method = 'GET', data = null, signal } = {}) {
    const options = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin', signal };
    if (method !== 'GET') {
      options.headers['X-CSRF-Token'] = csrfToken();
      if (data) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
      }
    }
    const res = await fetch(url, options);
    let body = {};
    try { body = await res.json(); } catch (_) { body = {}; }
    if (!res.ok) {
      const error = new Error(body.error || `Lỗi máy chủ (${res.status})`);
      error.status = res.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  // Ghi log tìm kiếm/lộ trình cho thống kê admin. Không bao giờ làm hỏng luồng chính.
  function logEvent(type, payload) {
    return apiFetch('api/log.php', { method: 'POST', data: { type, ...payload } }).catch(() => null);
  }

  root.SCApi = { apiFetch, logEvent, csrfToken };
})(window);
