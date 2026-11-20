// Theo dõi tiến độ trên tuyến khi đang dẫn đường (UMD -> window.RouteTracker).
// - locateOnRoute(): khoảng cách lệch tuyến + quãng đường đã đi/còn lại DỌC THEO tuyến.
// - createRerouteGate(): chỉ tính lại tuyến khi lệch thật sự (vượt ngưỡng, nới theo sai số GPS)
//   trong N mẫu liên tiếp, tránh việc GPS rung làm tuyến nhảy liên tục.
// - snapToRoute(): "map-matching" - kéo chấm vị trí về tuyến khi lệch nhỏ hơn sai số GPS.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RouteTracker = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function localXY(origin, p) {
    const mLat = 111320, mLng = 111320 * Math.cos(origin[0] * Math.PI / 180);
    return [(p[1] - origin[1]) * mLng, (p[0] - origin[0]) * mLat];
  }

  function locateOnRoute(point, coords) {
    if (!Array.isArray(coords) || coords.length < 2 || !Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    const origin = coords[0];
    const P = localXY(origin, point);
    let travelled = 0, best = null;
    const lengths = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const A = localXY(origin, coords[i]), B = localXY(origin, coords[i + 1]);
      const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy);
      lengths.push(len);
      const t = len ? Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (len * len))) : 0;
      const X = A[0] + t * dx, Y = A[1] + t * dy;
      const dist = Math.hypot(P[0] - X, P[1] - Y);
      if (!best || dist < best.offRoute) {
        best = {
          offRoute: dist, index: i, alongRoute: travelled + t * len,
          point: [coords[i][0] + t * (coords[i + 1][0] - coords[i][0]), coords[i][1] + t * (coords[i + 1][1] - coords[i][1])],
        };
      }
      travelled += len;
    }
    best.total = travelled;
    best.remaining = Math.max(0, travelled - best.alongRoute);
    return best;
  }

  function createRerouteGate({ threshold = 20, samples = 3 } = {}) {
    let count = 0;
    return {
      update(point, coords, accuracy = 0) {
        const loc = locateOnRoute(point, coords);
        if (!loc) return false;
        const limit = Math.max(threshold, Number(accuracy) || 0);
        count = loc.offRoute > limit ? count + 1 : 0;
        if (count >= samples) { count = 0; return true; }
        return false;
      },
      reset() { count = 0; },
    };
  }

  function snapToRoute(point, coords, accuracy, maxSnap = 15) {
    const loc = locateOnRoute(point, coords);
    if (!loc) return null;
    return loc.offRoute <= Math.min(Math.max(accuracy || 0, 5), maxSnap) ? loc.point : null;
  }

  return { locateOnRoute, createRerouteGate, snapToRoute };
});
