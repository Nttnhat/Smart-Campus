// UMD nhẹ: dùng được cả trong trình duyệt (<script src="js/lib/place-search.js">)
// lẫn trong Node (require) cho test - không cần build tool.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PlaceSearch = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function removeDiacritics(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  function matchesQuery(place, normalizedQuery) {
    if (!normalizedQuery) return true;
    const haystack = removeDiacritics(`${place.name || ''} ${place.aliases || ''}`);
    return haystack.includes(normalizedQuery);
  }

  function filterPlaces(places, { query, categoryId } = {}) {
    if (!Array.isArray(places)) return [];
    const normalizedQuery = removeDiacritics(query);
    return places.filter(place => {
      if (categoryId != null && place.category_id !== categoryId) return false;
      return matchesQuery(place, normalizedQuery);
    });
  }

  function groupByCategory(places) {
    if (!Array.isArray(places)) return {};
    return places.reduce((groups, place) => {
      const key = place.category_code || 'khac';
      if (!groups[key]) groups[key] = [];
      groups[key].push(place);
      return groups;
    }, {});
  }

  return { filterPlaces, groupByCategory, removeDiacritics };
});
