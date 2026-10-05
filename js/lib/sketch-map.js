(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.SketchMap = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PEDESTRIAN_HIGHWAYS = new Set(['footway', 'path', 'pedestrian', 'steps']);
  const ROAD_HIGHWAYS = new Set(['service', 'residential', 'unclassified', 'tertiary', 'living_street']);

  const GREEN_LEISURE = new Set(['pitch', 'park', 'garden', 'golf_course']);

  function classifyMapFeature(tags) {
    if (!tags) return 'ignore';
    if (tags.building) return 'building';
    if (tags.natural === 'water' || tags.waterway) return 'water';
    if (GREEN_LEISURE.has(tags.leisure) || tags.landuse === 'grass' || tags.natural === 'grass') return 'green';
    if (PEDESTRIAN_HIGHWAYS.has(tags.highway)) return 'pedestrian';
    if (ROAD_HIGHWAYS.has(tags.highway)) return 'road';
    return 'ignore';
  }

  // Bảng màu mô phỏng Google Maps thật (đường kem/xám, nước xanh dương nhạt,
  // tòa nhà trắng-xám, cây xanh/sân cỏ xanh lá nhạt) - không chữ/nhãn trong style.
  const SKETCH_STYLES = {
    building: { color: '#c7c2b3', weight: 1, fillColor: '#f0ede3', fillOpacity: 1 },
    water: { color: '#aad3df', weight: 1, fillColor: '#aad3df', fillOpacity: 1 },
    green: { color: '#b9dca3', weight: 1, fillColor: '#c6e8b4', fillOpacity: 1 },
    pedestrian: { color: '#e8e0c8', weight: 2.5, opacity: 1 },
    road: { color: '#f3f1e9', weight: 6, opacity: 1 },
  };

  function sketchStyleFor(classification) {
    return SKETCH_STYLES[classification] || null;
  }

  function isWithinCampus(lat, lng, bounds) {
    if (!bounds || typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return false;
    }
    return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
  }

  return { classifyMapFeature, sketchStyleFor, isWithinCampus };
});
