// Bộ lọc GPS cho trình duyệt (UMD -> window.GpsFilter).
// Vấn đề: laptop không có chip GPS (định vị qua Wi-Fi/IP sai 50–2000 m); điện thoại trong khu nhà
// cao tầng bị nhiễu/nhảy. Cách xử lý:
// 1) Khởi động: chỉ nhận mẫu đủ tốt (<= warmupAccuracy); hết warmupMs thì nhận mẫu tốt nhất + cờ kém.
// 2) Loại bước nhảy vô lý: quãng nhảy > tốc độ tối đa * dt + sai số 2 mẫu (3 lần liên tiếp thì chấp nhận
//    vì có thể người dùng thật sự đã đi xa, ví dụ tắt GPS một lúc).
// 3) Kalman 1 chiều cho từng trục (mét), nhiễu đo = accuracy², nhiễu quá trình tăng theo thời gian.
// 4) Nhận diện "không có GPS phần cứng": sai số > noGpsAccuracy kéo dài.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GpsFilter = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const M_PER_DEG = 111320;

  function distanceM(a, b) {
    const mLng = M_PER_DEG * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot((b.lat - a.lat) * M_PER_DEG, (b.lng - a.lng) * mLng);
  }

  function createGpsFilter(options = {}) {
    const cfg = {
      warmupAccuracy: 30, warmupMs: 10000, rejectAccuracy: 60, maxSpeed: 3,
      processNoise: 3, noGpsAccuracy: 100, ...options,
    };
    let state = null;         // {lat, lng, variance (m²), time}
    let warmStart = null;
    let best = null;
    let poorSince = null;
    let rejects = 0;
    let lastRaw = null;

    function output(status, extra = {}) {
      const noGpsHardware = poorSince !== null && lastRaw && lastRaw.time - poorSince >= cfg.warmupMs;
      const position = state ? {
        lat: state.lat, lng: state.lng, accuracy: Math.sqrt(state.variance), time: state.time,
        altitude: lastRaw?.altitude ?? null, altitudeAccuracy: lastRaw?.altitudeAccuracy ?? null,
        heading: lastRaw?.heading ?? null, speed: lastRaw?.speed ?? null, rawAccuracy: lastRaw?.accuracy ?? null,
      } : null;
      return { status, position, noGpsHardware: Boolean(noGpsHardware), rejected: false, ...extra };
    }

    function init(sample) {
      state = { lat: sample.lat, lng: sample.lng, variance: sample.accuracy ** 2, time: sample.time };
    }

    function trackStatus() {
      return Math.sqrt(state.variance) <= cfg.warmupAccuracy || (lastRaw && lastRaw.accuracy <= cfg.warmupAccuracy) ? 'ok' : 'low-accuracy';
    }

    function update(raw) {
      const sample = {
        ...raw, lat: Number(raw?.lat), lng: Number(raw?.lng), accuracy: Number(raw?.accuracy), time: Number(raw?.time ?? Date.now()),
      };
      if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lng) || !(sample.accuracy > 0)) {
        return output(state ? trackStatus() : 'warming', { rejected: true });
      }
      lastRaw = sample;
      if (sample.accuracy > cfg.noGpsAccuracy) { if (poorSince === null) poorSince = sample.time; } else poorSince = null;

      if (!state) {
        if (warmStart === null) warmStart = sample.time;
        if (!best || sample.accuracy < best.accuracy) best = sample;
        if (sample.accuracy <= cfg.warmupAccuracy) { init(sample); return output('ok'); }
        if (sample.time - warmStart >= cfg.warmupMs) { init(best); return output('low-accuracy'); }
        return output('warming');
      }

      const dt = Math.max(0, (sample.time - state.time) / 1000);
      const jump = distanceM(state, sample);
      const allowed = cfg.maxSpeed * dt + sample.accuracy + Math.sqrt(state.variance);
      const tooCoarse = sample.accuracy > cfg.rejectAccuracy && sample.accuracy > Math.sqrt(state.variance);
      if ((jump > allowed || tooCoarse) && rejects < 2) {
        rejects++;
        return output(trackStatus(), { rejected: true, reason: tooCoarse ? 'coarse' : 'jump' });
      }
      if (jump > allowed) { rejects = 0; init(sample); return output(trackStatus(), { reset: true }); }
      rejects = 0;

      // Kalman: dự đoán (phương sai tăng theo thời gian) rồi hiệu chỉnh bằng mẫu mới.
      const predicted = state.variance + cfg.processNoise * Math.max(dt, 0.2);
      const measurement = sample.accuracy ** 2;
      const k = predicted / (predicted + measurement);
      state = {
        lat: state.lat + k * (sample.lat - state.lat),
        lng: state.lng + k * (sample.lng - state.lng),
        variance: (1 - k) * predicted,
        time: sample.time,
      };
      return output(trackStatus());
    }

    function reset() {
      state = null; warmStart = null; best = null; poorSince = null; rejects = 0; lastRaw = null;
    }

    return { update, reset, get current() { return state ? { ...state } : null; } };
  }

  return { createGpsFilter, distanceM };
});
