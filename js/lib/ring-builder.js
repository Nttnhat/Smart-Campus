(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.RingBuilder = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const EPS = 1e-9;

  function same(a, b) {
    return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
  }

  function buildRings(segments) {
    if (!Array.isArray(segments)) return [];
    const pool = segments.filter(s => Array.isArray(s) && s.length >= 2).map(s => s.slice());
    const rings = [];

    while (pool.length) {
      let ring = pool.pop();
      let grew = true;
      while (grew && !same(ring[0], ring[ring.length - 1])) {
        grew = false;
        for (let i = 0; i < pool.length; i++) {
          const seg = pool[i];
          const tail = ring[ring.length - 1];
          if (same(seg[0], tail)) {
            ring = ring.concat(seg.slice(1));
          } else if (same(seg[seg.length - 1], tail)) {
            ring = ring.concat(seg.slice(0, -1).reverse());
          } else {
            continue;
          }
          pool.splice(i, 1);
          grew = true;
          break;
        }
      }
      if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
    }

    return rings;
  }

  return { buildRings };
});
