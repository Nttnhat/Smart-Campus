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

  function classifyMapFeature(tags) {
    if (!tags) return 'ignore';
    if (tags.building) return 'building';
    if (tags.natural === 'water' || tags.waterway) return 'water';
    if (PEDESTRIAN_HIGHWAYS.has(tags.highway)) return 'pedestrian';
    if (ROAD_HIGHWAYS.has(tags.highway)) return 'road';
    return 'ignore';
  }

  // Bảng màu "sketch": viền tay vẽ, không chữ/nhãn - chỉ hình khối.
  const SKETCH_STYLES = {
    building: { color: '#3a3a3a', weight: 1.5, fillColor: '#e8e4da', fillOpacity: 0.55, dashArray: '4 2' },
    water: { color: '#4f87a8', weight: 1.2, fillColor: '#bfe0ee', fillOpacity: 0.5 },
    pedestrian: { color: '#2f855a', weight: 2, dashArray: '3 4' },
    road: { color: '#6b6b6b', weight: 3, opacity: 0.7 },
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
