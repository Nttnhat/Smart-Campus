(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Entrances = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const ENTRANCES = [
    { id: 'toa-a-1', building: 'toa-a', lat: 10.732106, lng: 106.698996 },
    { id: 'toa-a-2', building: 'toa-a', lat: 10.732029, lng: 106.698918 },
    { id: 'toa-a-3', building: 'toa-a', lat: 10.731770, lng: 106.698938 },
    { id: 'toa-k-1', building: 'toa-k', lat: 10.730981, lng: 106.697624 },
    { id: 'toa-k-2', building: 'toa-k', lat: 10.730940, lng: 106.697763 },
    { id: 'toa-k-3', building: 'toa-k', lat: 10.730770, lng: 106.697642 },
    { id: 'toa-k-4', building: 'toa-k', lat: 10.730779, lng: 106.697740 },
    { id: 'toa-f-1', building: 'toa-f', lat: 10.730846, lng: 106.698810 },
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
