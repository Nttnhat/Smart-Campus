(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Entrances = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Lối vào đo từ ảnh khoanh vùng (màu đen) người dùng cung cấp, quy đổi bằng phép biến đổi affine
  // theo các điểm neo đã biết. toa-k giữ nguyên dữ liệu cũ (không có trong ảnh lần này).
  const ENTRANCES = [
    { id: 'toa-a-1', building: 'toa-a', lat: 10.732283, lng: 106.698923 },
    { id: 'toa-a-2', building: 'toa-a', lat: 10.73208, lng: 106.698932 },
    { id: 'toa-a-3', building: 'toa-a', lat: 10.732005, lng: 106.698752 },
    { id: 'toa-a-4', building: 'toa-a', lat: 10.731748, lng: 106.698738 },
    { id: 'toa-b-1', building: 'toa-b', lat: 10.732678, lng: 106.699458 },
    { id: 'toa-b-2', building: 'toa-b', lat: 10.732423, lng: 106.699177 },
    { id: 'toa-b-3', building: 'toa-b', lat: 10.732252, lng: 106.698682 },
    { id: 'toa-c-1', building: 'toa-c', lat: 10.731573, lng: 106.699049 },
    { id: 'toa-c-2', building: 'toa-c', lat: 10.731451, lng: 106.699297 },
    { id: 'toa-c-3', building: 'toa-c', lat: 10.731406, lng: 106.699019 },
    { id: 'toa-c-4', building: 'toa-c', lat: 10.731213, lng: 106.699564 },
    { id: 'toa-c-5', building: 'toa-c', lat: 10.731192, lng: 106.69943 },
    { id: 'toa-c-6', building: 'toa-c', lat: 10.731328, lng: 106.69894 },
    { id: 'toa-c-7', building: 'toa-c', lat: 10.731228, lng: 106.699131 },
    { id: 'toa-d-1', building: 'toa-d', lat: 10.732859, lng: 106.698666 },
    { id: 'toa-d-2', building: 'toa-d', lat: 10.732898, lng: 106.69892 },
    { id: 'toa-d-3', building: 'toa-d', lat: 10.732691, lng: 106.698837 },
    { id: 'toa-e-1', building: 'toa-e', lat: 10.733032, lng: 106.699552 },
    { id: 'toa-e-2', building: 'toa-e', lat: 10.732937, lng: 106.699465 },
    { id: 'toa-e-3', building: 'toa-e', lat: 10.732771, lng: 106.69902 },
    { id: 'toa-f-1', building: 'toa-f', lat: 10.730976, lng: 106.698949 },
    { id: 'toa-f-2', building: 'toa-f', lat: 10.731031, lng: 106.69875 },
    { id: 'toa-g-1', building: 'toa-g', lat: 10.730917, lng: 106.699208 },
    { id: 'toa-g-2', building: 'toa-g', lat: 10.730739, lng: 106.69918 },
    { id: 'nha-i-1', building: 'nha-i', lat: 10.733208, lng: 106.696758 },
    { id: 'nha-i-2', building: 'nha-i', lat: 10.733035, lng: 106.696765 },
    { id: 'ho-boi-1', building: 'ho-boi', lat: 10.732743, lng: 106.697041 },
    { id: 'ho-boi-2', building: 'ho-boi', lat: 10.732689, lng: 106.697024 },
    { id: 'san-tennis-1', building: 'san-tennis', lat: 10.732487, lng: 106.6973 },
    { id: 'nha-thi-dau-1', building: 'nha-thi-dau', lat: 10.732036, lng: 106.697875 },
    { id: 'nha-thi-dau-2', building: 'nha-thi-dau', lat: 10.731607, lng: 106.697874 },
    { id: 'toa-m-1', building: 'toa-m', lat: 10.730694, lng: 106.697843 },
    { id: 'toa-m-2', building: 'toa-m', lat: 10.730636, lng: 106.698088 },
    { id: 'toa-m-3', building: 'toa-m', lat: 10.730655, lng: 106.698175 },
    { id: 'trung-tam-qpan-1', building: 'trung-tam-qpan', lat: 10.730828, lng: 106.698369 },
    { id: 'trung-tam-qpan-2', building: 'trung-tam-qpan', lat: 10.730605, lng: 106.698546 },
    { id: 'trung-tam-qpan-3', building: 'trung-tam-qpan', lat: 10.730552, lng: 106.698418 },
    { id: 'toa-l-1', building: 'toa-l', lat: 10.730979, lng: 106.697609 },
    { id: 'toa-l-2', building: 'toa-l', lat: 10.730946, lng: 106.697557 },
    { id: 'toa-l-3', building: 'toa-l', lat: 10.730971, lng: 106.697787 },
    { id: 'toa-l-4', building: 'toa-l', lat: 10.730828, lng: 106.69792 },
    { id: 'san-qpan-1', building: 'san-qpan', lat: 10.730912, lng: 106.698494 },
    { id: 'toa-k-1', building: 'toa-k', lat: 10.730981, lng: 106.697624 },
    { id: 'toa-k-2', building: 'toa-k', lat: 10.730940, lng: 106.697763 },
    { id: 'toa-k-3', building: 'toa-k', lat: 10.730770, lng: 106.697642 },
    { id: 'toa-k-4', building: 'toa-k', lat: 10.730779, lng: 106.697740 },
  ];

  function distanceM(lat1, lng1, lat2, lng2) {
    const dLat = (lat2 - lat1) * 111320;
    const dLng = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  }

  function entrancesFor(buildingId) {
    return ENTRANCES.filter(e => e.building === buildingId);
  }

  function nearestEntrance(buildingId, lat, lng) {
    let best = null;
    let bestDist = Infinity;
    for (const e of entrancesFor(buildingId)) {
      const d = distanceM(lat, lng, e.lat, e.lng);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  return { ENTRANCES, entrancesFor, nearestEntrance };
});
