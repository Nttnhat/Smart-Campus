(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.LocationLocator = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const EARTH_RADIUS_M = 6371000;

  function haversineM(a, b) {
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }

  function nearest(point, items) {
    let best = null;
    let bestDist = Infinity;
    for (const item of items) {
      const dist = haversineM(point, item);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    return best ? { item: best, distanceM: bestDist } : null;
  }

  function locateCurrentPosition(point, { buildings = [], roadNodes = [], buildingRadiusM = 30 } = {}) {
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      return { type: 'unknown' };
    }

    const nearestBuilding = nearest(point, buildings);
    if (nearestBuilding && nearestBuilding.distanceM <= buildingRadiusM) {
      return {
        type: 'building',
        name: nearestBuilding.item.name,
        placeId: nearestBuilding.item.place_id,
        distanceM: nearestBuilding.distanceM,
      };
    }

    const nearestRoad = nearest(point, roadNodes);
    if (nearestRoad) {
      return {
        type: 'road',
        nodeId: nearestRoad.item.id,
        distanceM: nearestRoad.distanceM,
      };
    }

    return { type: 'unknown' };
  }

  function formatRouteSteps(nodeIds, edgesByPair = {}) {
    if (!Array.isArray(nodeIds) || nodeIds.length < 2) return [];

    const steps = [];
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const from = nodeIds[i];
      const to = nodeIds[i + 1];
      const edge = edgesByPair[`${from}-${to}`] || edgesByPair[`${to}-${from}`];
      const roadName = (edge && edge.name) || 'Đường nội bộ';
      const distanceM = (edge && Number(edge.length_m)) || 0;

      const last = steps[steps.length - 1];
      if (last && last.roadName === roadName) {
        last.distanceM += distanceM;
      } else {
        steps.push({ roadName, distanceM });
      }
    }
    return steps;
  }

  return { locateCurrentPosition, formatRouteSteps, haversineM };
});
