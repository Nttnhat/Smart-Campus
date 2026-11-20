// Router đi bộ trong khuôn viên (UMD: trình duyệt -> window.WalkRouter, Node -> module.exports).
// - buildGraphFromEdges(): đồ thị từ database (road_nodes/road_edges, admin chỉnh được).
// - buildGraphFromOsm():   đồ thị dự phòng từ dữ liệu OSM (Overpass/snapshot).
// - shortestRoute():       A* với heuristic = khoảng cách chim bay (luôn <= chi phí thật vì chi phí
//                          cạnh = khoảng cách mét thuần) nên luôn trả tuyến ngắn nhất, bằng Dijkstra.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WalkRouter = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const WALK_SPEED_MPS = 1.35;
  // Hệ số chi phí theo loại đường: < 1 là ưu tiên, > 1 là hạn chế đi.
  const FACTORS = {
    pedestrian: 0.96, footway: 1.0, corridor: 1.0, crossing: 1.0, service: 1.04,
    living_street: 1.08, residential: 1.14, unclassified: 1.14, road: 1.14, path: 1.32, steps: 1.55,
  };
  const SKIP_SERVICE = new Set(['parking_aisle', 'drive-through']);

  function haversine(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function validPoint(p) {
    return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  }

  function nodeKey(p) {
    return `${Number(p[0]).toFixed(7)},${Number(p[1]).toFixed(7)}`;
  }

  function emptyGraph() {
    return { nodes: new Map(), adjacency: new Map(), segments: [], pairs: new Set() };
  }

  // Chi phí = khoảng cách thuần (mét) - tuyến chọn luôn là tuyến ngắn nhất về quãng đường thực tế,
  // không ưu tiên/hạn chế theo loại đường nữa.
  function addSegment(graph, a, b, meta) {
    if (!validPoint(a) || !validPoint(b)) return;
    const ka = nodeKey(a), kb = nodeKey(b);
    if (ka === kb) return;
    const pair = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (graph.pairs.has(pair)) return; // cạnh 2 chiều lưu 2 lần trong database
    const distance = haversine(a, b);
    if (!(distance >= 0.05)) return;
    graph.pairs.add(pair);
    for (const [k, p] of [[ka, a], [kb, b]]) {
      if (!graph.nodes.has(k)) graph.nodes.set(k, { id: k, coords: [Number(p[0]), Number(p[1])] });
      if (!graph.adjacency.has(k)) graph.adjacency.set(k, []);
    }
    const cost = distance;
    graph.adjacency.get(ka).push({ to: kb, distance, cost, meta });
    graph.adjacency.get(kb).push({ to: ka, distance, cost, meta });
    graph.segments.push({ a: ka, b: kb, aCoords: graph.nodes.get(ka).coords, bCoords: graph.nodes.get(kb).coords, distance, cost, meta });
  }

  // edges: [{from, to, type, cost_factor?, name?, active?}], nodes: [{id, lat, lng}]
  function buildGraphFromEdges(data, options = {}) {
    const graph = emptyGraph();
    const coords = new Map();
    for (const n of (data && data.nodes) || []) {
      const lat = Number(n.lat), lng = Number(n.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) coords.set(String(n.id), [lat, lng]);
    }
    for (const e of (data && data.edges) || []) {
      const type = e.type || 'footway';
      if (options.avoidSteps && type === 'steps') continue;
      if (e.active === 0 || e.active === false) continue;
      const a = coords.get(String(e.from)), b = coords.get(String(e.to));
      if (!a || !b) continue;
      addSegment(graph, a, b, { source: 'db', type, name: e.name || '', edgeId: e.id ?? null });
    }
    return graph;
  }

  function pointInPolygon(point, polygon) {
    const y = point[0], x = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0], xi = polygon[i][1], yj = polygon[j][0], xj = polygon[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
    }
    return inside;
  }

  function orient(a, b, c) {
    return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
  }

  // Cắt nhau thật sự (không tính chạm đầu mút) - lối đi kết thúc ở cửa tòa nhà vẫn hợp lệ.
  function segmentsCross(a, b, c, d) {
    return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  }

  function bboxOf(points) {
    let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
    for (const p of points) { s = Math.min(s, p[0]); n = Math.max(n, p[0]); w = Math.min(w, p[1]); e = Math.max(e, p[1]); }
    return { s, w, n, e };
  }

  function bboxOverlap(a, b) {
    return a.s <= b.n && b.s <= a.n && a.w <= b.e && b.w <= a.e;
  }

  function wayPoints(el) {
    return ((el && el.geometry) || []).map(p => [Number(p.lat), Number(p.lon)]).filter(validPoint);
  }

  function isWalkableWay(tags, options) {
    const h = tags.highway;
    if (!h || !(h in FACTORS)) return false;
    if (options.avoidSteps && h === 'steps') return false;
    if (tags.access === 'no' || tags.access === 'private' || tags.foot === 'no') return false;
    if (tags.tunnel === 'yes' || tags.tunnel === 'culvert') return false; // hầm xe, cống
    if (h === 'service' && (SKIP_SERVICE.has(tags.service) || Number(tags.layer) < 0)) return false;
    return true;
  }

  // Lối đi có mái/xuyên sảnh được phép đi qua polygon tòa nhà.
  function passesThroughBuildings(tags) {
    return tags.highway === 'corridor' || tags.tunnel === 'building_passage' || tags.covered === 'yes' || tags.indoor === 'yes';
  }

  function normaliseBoundary(boundary) {
    if (!Array.isArray(boundary) || !boundary.length) return [];
    return validPoint(boundary[0]) ? [boundary] : boundary.filter(r => Array.isArray(r) && r.length >= 3);
  }

  function buildGraphFromOsm(elements, options = {}) {
    const graph = emptyGraph();
    const list = Array.isArray(elements) ? elements : [];
    const obstacles = [];
    const barriers = [];
    for (const el of list) {
      const tags = el.tags || {};
      const pts = wayPoints(el);
      if (pts.length >= 3 && (tags.building || tags.natural === 'water' || tags.waterway === 'riverbank')) {
        obstacles.push({ ring: pts, box: bboxOf(pts) });
      }
      if (pts.length >= 2 && (tags.barrier === 'fence' || tags.barrier === 'wall')) {
        barriers.push({ line: pts, box: bboxOf(pts) });
      }
    }
    const boundary = normaliseBoundary(options.boundary);

    const blocked = (a, b, tags) => {
      const box = bboxOf([a, b]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (boundary.length && !boundary.some(r => pointInPolygon(mid, r))) return true;
      if (!passesThroughBuildings(tags)) {
        for (const o of obstacles) {
          if (!bboxOverlap(box, o.box)) continue;
          if (pointInPolygon(mid, o.ring)) return true;
          // Xuyên hẳn qua tòa nhà = cắt viền >= 2 lần. Cắt 1 lần thường là lối đi vẽ chạm/đi vào
          // sảnh (dữ liệu OSM thật rất hay như vậy) - chặn luôn sẽ làm vỡ mạng đường.
          let crossings = 0;
          for (let i = 0; i < o.ring.length - 1; i++) if (segmentsCross(a, b, o.ring[i], o.ring[i + 1])) crossings++;
          if (crossings >= 2) return true;
        }
      }
      for (const bar of barriers) {
        if (!bboxOverlap(box, bar.box)) continue;
        for (let i = 0; i < bar.line.length - 1; i++) if (segmentsCross(a, b, bar.line[i], bar.line[i + 1])) return true;
      }
      return false;
    };

    for (const el of list) {
      const tags = el.tags || {};
      if (!isWalkableWay(tags, options)) continue;
      const pts = wayPoints(el);
      const meta = { source: 'osm', wayId: el.id, type: tags.highway, name: tags.name || '' };
      for (let i = 0; i < pts.length - 1; i++) {
        if (!blocked(pts[i], pts[i + 1], tags)) addSegment(graph, pts[i], pts[i + 1], meta);
      }
    }
    return graph;
  }

  function projectPointToSegment(point, a, b) {
    const mLat = 111320, mLng = 111320 * Math.cos(point[0] * Math.PI / 180);
    const px = point[1] * mLng, py = point[0] * mLat;
    const ax = a[1] * mLng, ay = a[0] * mLat, bx = b[1] * mLng, by = b[0] * mLat;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    return { t, point: [y / mLat, x / mLng], distance: Math.hypot(px - x, py - y) };
  }

  function nearestProjection(graph, point, maxDistance = 120) {
    if (!graph || !validPoint(point)) return null;
    let best = null;
    for (const seg of graph.segments) {
      const p = projectPointToSegment(point, seg.aCoords, seg.bCoords);
      if (!best || p.distance < best.distance) best = { ...p, segment: seg };
    }
    return best && best.distance <= maxDistance ? best : null;
  }

  // Min-heap nhỏ gọn cho A*.
  function createHeap() {
    const items = [];
    const up = i => {
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent].f <= items[i].f) break;
        [items[parent], items[i]] = [items[i], items[parent]];
        i = parent;
      }
    };
    const down = i => {
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < items.length && items[l].f < items[m].f) m = l;
        if (r < items.length && items[r].f < items[m].f) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    };
    return {
      get size() { return items.length; },
      push(item) { items.push(item); up(items.length - 1); },
      pop() {
        const top = items[0];
        const last = items.pop();
        if (items.length) { items[0] = last; down(0); }
        return top;
      },
    };
  }

  function bearing(a, b) {
    const rad = Math.PI / 180;
    const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
    const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function simplifyCollinear(coords, angleTolerance = 6) {
    if (coords.length <= 2) return coords.slice();
    const out = [coords[0]];
    for (let i = 1; i < coords.length - 1; i++) {
      const prev = out[out.length - 1];
      const turn = Math.abs(((bearing(coords[i], coords[i + 1]) - bearing(prev, coords[i]) + 540) % 360) - 180);
      if (turn >= angleTolerance) out.push(coords[i]);
    }
    out.push(coords[coords.length - 1]);
    return out;
  }

  // Bước chỉ đường kiểu Google Maps: mỗi bước = đi X mét rồi rẽ (maneuver ở điểm rẽ).
  function makeRouteSteps(coords, defaultName = 'Đường nội bộ TDTU') {
    if (coords.length < 2) return [];
    const steps = [];
    let segDistance = 0;
    for (let i = 1; i < coords.length; i++) {
      segDistance += haversine(coords[i - 1], coords[i]);
      if (i < coords.length - 1) {
        const d = ((bearing(coords[i], coords[i + 1]) - bearing(coords[i - 1], coords[i]) + 540) % 360) - 180;
        if (Math.abs(d) >= 28) {
          const modifier = Math.abs(d) >= 135 ? 'uturn' : Math.abs(d) < 50 ? (d > 0 ? 'slight right' : 'slight left') : (d > 0 ? 'right' : 'left');
          steps.push({
            distance: segDistance, duration: segDistance / WALK_SPEED_MPS, name: defaultName,
            maneuver: { type: steps.length ? 'turn' : 'depart', modifier, location: [coords[i][1], coords[i][0]] },
          });
          segDistance = 0;
        }
      }
    }
    const last = coords[coords.length - 1];
    if (segDistance > 0) {
      steps.push({ distance: segDistance, duration: segDistance / WALK_SPEED_MPS, name: defaultName, maneuver: { type: steps.length ? 'continue' : 'depart', modifier: 'straight', location: [last[1], last[0]] } });
    }
    steps.push({ distance: 0, duration: 0, name: 'Điểm đến', maneuver: { type: 'arrive', modifier: 'straight', location: [last[1], last[0]] } });
    return steps;
  }

  function shortestRoute(graph, startPoint, endPoint, options = {}) {
    const maxSnap = options.maxSnap ?? 120;
    const start = [Number(startPoint.lat), Number(startPoint.lng)];
    const end = [Number(endPoint.lat), Number(endPoint.lng)];
    const sp = nearestProjection(graph, start, maxSnap);
    const ep = nearestProjection(graph, end, maxSnap);
    if (!sp || !ep) throw new Error('NoWalkNetwork');

    const S = '__start__', E = '__end__';
    const coordsOf = id => (id === S ? sp.point : id === E ? ep.point : graph.nodes.get(id).coords);
    // Cạnh ảo nối điểm chiếu vào 2 đầu đoạn đường chứa nó (không sửa đồ thị gốc đang cache).
    const extra = new Map([[S, []], [E, []]]);
    const link = (id, proj) => {
      const s = proj.segment, factor = s.cost / Math.max(s.distance, 1e-3);
      const da = s.distance * proj.t, db = s.distance * (1 - proj.t);
      extra.get(id).push({ to: s.a, distance: da, cost: da * factor }, { to: s.b, distance: db, cost: db * factor });
      for (const [node, d] of [[s.a, da], [s.b, db]]) {
        if (!extra.has(node)) extra.set(node, []);
        extra.get(node).push({ to: id, distance: d, cost: d * factor });
      }
    };
    link(S, sp);
    link(E, ep);
    if (sp.segment === ep.segment) {
      const d = haversine(sp.point, ep.point), factor = sp.segment.cost / Math.max(sp.segment.distance, 1e-3);
      extra.get(S).push({ to: E, distance: d, cost: d * factor });
    }
    const edgesOf = id => {
      const base = graph.adjacency.get(id) || [];
      const add = extra.get(id);
      return add ? base.concat(add) : base;
    };

    const h = id => haversine(coordsOf(id), ep.point); // bằng đúng khoảng cách thật -> không bao giờ ước lượng quá
    const g = new Map([[S, 0]]);
    const prev = new Map();
    const closed = new Set();
    const heap = createHeap();
    heap.push({ id: S, f: h(S) });
    while (heap.size) {
      const { id } = heap.pop();
      if (closed.has(id)) continue;
      if (id === E) break;
      closed.add(id);
      const base = g.get(id);
      for (const edge of edgesOf(id)) {
        if (closed.has(edge.to)) continue;
        const tentative = base + edge.cost;
        if (tentative < (g.get(edge.to) ?? Infinity)) {
          g.set(edge.to, tentative);
          prev.set(edge.to, id);
          heap.push({ id: edge.to, f: tentative + h(edge.to) });
        }
      }
    }
    if (!g.has(E)) throw new Error('NoCampusWalkRoute');

    const ids = [E];
    while (ids[0] !== S) ids.unshift(prev.get(ids[0]));
    let coords = ids.map(coordsOf);
    coords = coords.filter((c, i) => i === 0 || haversine(c, coords[i - 1]) > 0.05);
    // Điểm đến (vd cửa tòa nhà) thường nằm cách đường đi vài mét: tuyến kết thúc ở điểm chiếu lên đường.
    // Nối nốt đoạn ngắn đó tới đúng điểm đến và báo `endGap` để so sánh công bằng giữa các cửa.
    const endGap = haversine(ep.point, end);
    if (endGap > 1 && endGap <= 40) coords.push(end);
    if (coords.length === 1) coords.push(ep.point);
    coords = simplifyCollinear(coords);
    let distance = 0;
    for (let i = 1; i < coords.length; i++) distance += haversine(coords[i - 1], coords[i]);
    const steps = makeRouteSteps(coords);

    return {
      distance,
      duration: distance / WALK_SPEED_MPS,
      cost: g.get(E),
      endGap,
      coords,
      steps,
      geometry: { type: 'LineString', coordinates: coords.map(([lat, lng]) => [lng, lat]) },
      legs: [{ steps }],
      snap: { start: sp, end: ep },
      source: options.source || 'tdtu-walk-graph',
    };
  }

  return {
    FACTORS, WALK_SPEED_MPS, haversine, nodeKey, pointInPolygon,
    buildGraphFromEdges, buildGraphFromOsm, nearestProjection, projectPointToSegment,
    shortestRoute, makeRouteSteps, simplifyCollinear,
  };
});
