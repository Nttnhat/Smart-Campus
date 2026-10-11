(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Coverage = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const M_PER_DEG_LAT = 111320;

  function metersPerDegLng(atLat) {
    return 111320 * Math.cos((atLat * Math.PI) / 180);
  }

  // Khoảng cách Đông-Tây/Bắc-Nam tính bằng mét từ tâm (centerLat,centerLng) tới (lat,lng).
  // Dùng hệ quy chiếu phẳng cục bộ (equirectangular) - đủ chính xác ở phạm vi 1 khuôn viên.
  function localOffsetM(centerLat, centerLng, lat, lng) {
    const dLat = (lat - centerLat) * M_PER_DEG_LAT;
    const dLng = (lng - centerLng) * metersPerDegLng(centerLat);
    return { north: dLat, east: dLng };
  }

  function isPointInCoverage(lat, lng, centerLat, centerLng, coverage) {
    if (!coverage || !Number.isFinite(lat) || !Number.isFinite(lng) ||
        !Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return false;
    const { north, east } = localOffsetM(centerLat, centerLng, lat, lng);
    const dist = Math.hypot(north, east);

    switch (coverage.type) {
      case 'circle': {
        const diameterM = Number(coverage.diameterM);
        if (!Number.isFinite(diameterM) || diameterM <= 0) return false;
        return dist <= diameterM / 2;
      }
      case 'square': {
        // Hình vuông trục thẳng theo kinh/vĩ (không xoay), kích thước cho bằng đường chéo.
        // Nửa cạnh = (đường chéo / 2) / sqrt(2) = đường chéo / (2*sqrt(2)).
        const diagonalM = Number(coverage.diagonalM);
        if (!Number.isFinite(diagonalM) || diagonalM <= 0) return false;
        const halfSide = diagonalM / (2 * Math.SQRT2);
        return Math.abs(north) <= halfSide && Math.abs(east) <= halfSide;
      }
      default:
        return false;
    }
  }

  // Bán kính "an toàn" dùng để lọc sơ bộ ứng viên trước khi gọi isPointInCoverage
  // (vd quét danh sách địa điểm gần một điểm bấm). Lấy giá trị bao trọn hình dạng.
  function coverageRadiusM(coverage) {
    if (!coverage) return 0;
    if (coverage.type === 'circle') return Number(coverage.diameterM) / 2 || 0;
    if (coverage.type === 'square') return Number(coverage.diagonalM) / 2 || 0;
    return 0;
  }

  return { isPointInCoverage, coverageRadiusM, localOffsetM };
});
