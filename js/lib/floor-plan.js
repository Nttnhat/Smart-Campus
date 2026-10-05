(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.FloorPlan = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function buildFloorSummary(building, floors) {
    const list = Array.isArray(floors) ? floors : [];
    const roomCount = list.reduce((sum, f) => sum + (Number(f.room_count) || 0), 0);
    return {
      placeId: building ? building.place_id : null,
      name: building ? building.name : '',
      description: building ? building.description || '' : '',
      code: building ? building.code || '' : '',
      hasFloors: list.length > 0,
      floorCount: list.length,
      roomCount,
      floors: list,
    };
  }

  function getFloorByLevel(floors, level) {
    if (!Array.isArray(floors)) return null;
    const found = floors.find(f => f.level === level);
    return found || null;
  }

  return { buildFloorSummary, getFloorByLevel };
});
