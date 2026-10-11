(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ResolvePlace = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const EARTH_RADIUS_M = 6371000;

  function distanceM(lat1, lng1, lat2, lng2) {
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }

  function pointInRing(lat, lng, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function findAreaAtPoint(lat, lng, areas) {
    if (!Array.isArray(areas)) return null;
    for (const area of areas) {
      for (const ring of area.rings || []) {
        if (pointInRing(lat, lng, ring)) return area;
      }
    }
    return null;
  }

  // place.coverage (nếu có, dạng {type:'circle',diameterM} | {type:'square',diagonalM} - xem
  // js/lib/coverage.js) ưu tiên hơn fallbackRadiusM: mỗi nơi được nhận diện theo đúng hình dạng/kích
  // thước riêng của nó thay vì một bán kính chung cho mọi nơi.
  function resolvePlaceAtPoint(lat, lng, places, fallbackRadiusM, areas = []) {
    if (!Array.isArray(places) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const Coverage = typeof window !== 'undefined' ? window.Coverage : require('./coverage.js');
    let best = null;
    let bestDist = Infinity;
    for (const place of places) {
      const inCoverage = place.coverage && Coverage
        ? Coverage.isPointInCoverage(lat, lng, place.lat, place.lng, place.coverage)
        : distanceM(lat, lng, place.lat, place.lng) <= fallbackRadiusM;
      if (!inCoverage) continue;
      const d = distanceM(lat, lng, place.lat, place.lng);
      if (d < bestDist) {
        best = place;
        bestDist = d;
      }
    }
    return best || findAreaAtPoint(lat, lng, areas);
  }

  return { resolvePlaceAtPoint, distanceM };
});
