// User journeys (tìm đường đi bộ trong khuôn viên):
// 1) Tuyến trả về luôn là tuyến ngắn nhất theo chi phí (A* không được cho kết quả kém hơn Dijkstra),
//    kể cả khi có loại đường hệ số < 1 (pedestrian 0.96) - lỗi heuristic cũ.
// 2) Đồ thị từ database: cạnh lưu 2 chiều không bị nhân đôi; "Tránh bậc thang" bỏ cạnh steps.
// 3) Đồ thị từ OSM: bỏ đường hầm (hầm xe), lối trong bãi xe, đường cấm người đi bộ, đoạn xuyên tòa nhà,
//    và đoạn nằm ngoài ranh giới trường.
// 4) Bước chỉ đường: rẽ trái/phải đúng chiều, bước cuối là "arrive".
// 5) Hai điểm không nối được -> lỗi rõ ràng; điểm quá xa mạng đường -> null.

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/lib/walk-router.js');

// Lưới nhỏ quanh campus: 1e-4 độ ~ 11 m.
const LAT0 = 10.7310, LNG0 = 106.6980, D = 0.0001;
const p = (i, j) => [LAT0 + i * D, LNG0 + j * D];

function gridEdges(n, factorFor) {
  const nodes = [];
  const edges = [];
  const id = (i, j) => i * n + j + 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) nodes.push({ id: id(i, j), lat: p(i, j)[0], lng: p(i, j)[1] });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (j + 1 < n) edges.push({ from: id(i, j), to: id(i, j + 1), type: 'footway', cost_factor: factorFor(i, j, 'h') });
    if (i + 1 < n) edges.push({ from: id(i, j), to: id(i + 1, j), type: 'footway', cost_factor: factorFor(i, j, 'v') });
  }
  return { nodes, edges };
}

function dijkstraCost(graph, startId, endId) {
  const dist = new Map([[startId, 0]]);
  const done = new Set();
  while (true) {
    let cur = null, best = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < best) { best = v; cur = k; }
    if (cur === null) return Infinity;
    if (cur === endId) return best;
    done.add(cur);
    for (const e of graph.adjacency.get(cur) || []) {
      const nd = best + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) dist.set(e.to, nd);
    }
  }
}

test('A* luôn cho chi phí bằng Dijkstra (heuristic không được ước lượng quá)', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const factors = [0.96, 1.0, 1.04, 1.32, 1.55];
  for (let trial = 0; trial < 25; trial++) {
    const g = R.buildGraphFromEdges(gridEdges(7, () => factors[Math.floor(rand() * factors.length)]));
    const start = p(0, 0), end = p(6, 6);
    const route = R.shortestRoute(g, { lat: start[0], lng: start[1] }, { lat: end[0], lng: end[1] });
    const expected = dijkstraCost(g, R.nodeKey(start), R.nodeKey(end));
    assert.ok(Math.abs(route.cost - expected) < 1e-6, `trial ${trial}: ${route.cost} vs ${expected}`);
  }
});

test('đồ thị database: cạnh 2 chiều lưu 2 lần không bị nhân đôi', () => {
  const nodes = [{ id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 1)[0], lng: p(0, 1)[1] }];
  const g = R.buildGraphFromEdges({ nodes, edges: [{ from: 1, to: 2, type: 'footway' }, { from: 2, to: 1, type: 'footway' }] });
  assert.equal(g.segments.length, 1);
  assert.equal(g.adjacency.get(R.nodeKey(p(0, 0))).length, 1);
});

test('tránh bậc thang: bỏ cạnh steps, tuyến đi đường vòng', () => {
  const nodes = [
    { id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 2)[0], lng: p(0, 2)[1] },
    { id: 3, lat: p(2, 0)[0], lng: p(2, 0)[1] }, { id: 4, lat: p(2, 2)[0], lng: p(2, 2)[1] },
  ];
  const edges = [
    { from: 1, to: 2, type: 'steps' },
    { from: 1, to: 3, type: 'footway' }, { from: 3, to: 4, type: 'footway' }, { from: 4, to: 2, type: 'footway' },
  ];
  const a = { lat: p(0, 0)[0], lng: p(0, 0)[1] }, b = { lat: p(0, 2)[0], lng: p(0, 2)[1] };
  const normal = R.shortestRoute(R.buildGraphFromEdges({ nodes, edges }), a, b);
  const noSteps = R.shortestRoute(R.buildGraphFromEdges({ nodes, edges }, { avoidSteps: true }), a, b);
  assert.ok(normal.distance < 30);
  assert.ok(noSteps.distance > 60);
});

function way(id, tags, pts) {
  return { type: 'way', id, tags, geometry: pts.map(([lat, lon]) => ({ lat, lon })) };
}

test('đồ thị OSM: bỏ hầm xe, lối bãi xe, đường cấm đi bộ', () => {
  const g = R.buildGraphFromOsm([
    way(1, { highway: 'footway' }, [p(0, 0), p(0, 3)]),
    way(2, { highway: 'service', tunnel: 'yes', layer: '-1' }, [p(1, 0), p(1, 3)]),
    way(3, { highway: 'service', service: 'parking_aisle' }, [p(2, 0), p(2, 3)]),
    way(4, { highway: 'path', foot: 'no' }, [p(3, 0), p(3, 3)]),
    way(5, { highway: 'service', access: 'private' }, [p(4, 0), p(4, 3)]),
  ]);
  assert.deepEqual([...new Set(g.segments.map(s => s.meta.wayId))], [1]);
});

test('đồ thị OSM: đoạn đường xuyên hẳn qua tòa nhà bị chặn, kể cả khi điểm giữa nằm ngoài', () => {
  const building = way(9, { building: 'yes' }, [p(-1, 1), p(1, 1), p(1, 1.4), p(-1, 1.4), p(-1, 1)]);
  const g = R.buildGraphFromOsm([building, way(1, { highway: 'footway' }, [p(0, 0), p(0, 3)])]);
  assert.equal(g.segments.length, 0);
});

test('đồ thị OSM: lối đi đi vào sảnh (cắt viền 1 lần) và lối có mái được giữ lại', () => {
  const building = way(9, { building: 'yes' }, [p(-1, 1), p(1, 1), p(1, 2), p(-1, 2), p(-1, 1)]);
  const g = R.buildGraphFromOsm([
    building,
    way(1, { highway: 'footway' }, [p(0, 0), p(0, 1.2)]),
    way(2, { highway: 'footway', covered: 'yes' }, [p(0.5, 0), p(0.5, 3)]),
  ]);
  assert.deepEqual(g.segments.map(s => s.meta.wayId).sort(), [1, 2]);
});

test('đồ thị OSM: cắt theo ranh giới trường nếu có', () => {
  const boundary = [p(-5, -5), p(-5, 5), p(5, 5), p(5, -5)];
  const g = R.buildGraphFromOsm([
    way(1, { highway: 'footway' }, [p(0, 0), p(0, 2)]),
    way(2, { highway: 'residential' }, [p(20, 0), p(20, 2)]),
  ], { boundary });
  assert.deepEqual(g.segments.map(s => s.meta.wayId), [1]);
});

test('đồ thị OSM: đoạn đường cắt ngang hàng rào/tường (barrier) bị chặn', () => {
  const fence = way(9, { barrier: 'fence' }, [p(-1, 1), p(1, 1)]);
  const g = R.buildGraphFromOsm([fence, way(1, { highway: 'footway' }, [p(0, 0), p(0, 3)])]);
  assert.equal(g.segments.length, 0);
});

test('bước chỉ đường: đi về Đông rồi rẽ lên Bắc là rẽ TRÁI, bước cuối là arrive', () => {
  const nodes = [
    { id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 3)[0], lng: p(0, 3)[1] },
    { id: 3, lat: p(3, 3)[0], lng: p(3, 3)[1] },
  ];
  const g = R.buildGraphFromEdges({ nodes, edges: [{ from: 1, to: 2, type: 'footway' }, { from: 2, to: 3, type: 'footway' }] });
  const route = R.shortestRoute(g, { lat: p(0, 0)[0], lng: p(0, 0)[1] }, { lat: p(3, 3)[0], lng: p(3, 3)[1] });
  const turn = route.steps.find(s => s.maneuver.type === 'turn' || s.maneuver.type === 'depart');
  assert.equal(turn.maneuver.modifier, 'left');
  assert.equal(route.steps[route.steps.length - 1].maneuver.type, 'arrive');
  assert.ok(Math.abs(route.distance - 66) < 3, String(route.distance));
});

test('hai cụm đường không nối nhau -> NoCampusWalkRoute; điểm xa mạng đường -> null', () => {
  const nodes = [
    { id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 1)[0], lng: p(0, 1)[1] },
    { id: 3, lat: p(5, 0)[0], lng: p(5, 0)[1] }, { id: 4, lat: p(5, 1)[0], lng: p(5, 1)[1] },
  ];
  const g = R.buildGraphFromEdges({ nodes, edges: [{ from: 1, to: 2 }, { from: 3, to: 4 }] });
  assert.throws(() => R.shortestRoute(g, { lat: p(0, 0)[0], lng: p(0, 0)[1] }, { lat: p(5, 1)[0], lng: p(5, 1)[1] }), /NoCampusWalkRoute/);
  assert.equal(R.nearestProjection(g, p(100, 100), 50), null);
});

test('điểm đầu và cuối cùng nằm trên 1 đoạn -> đi thẳng theo đoạn đó', () => {
  const nodes = [{ id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 10)[0], lng: p(0, 10)[1] }];
  const g = R.buildGraphFromEdges({ nodes, edges: [{ from: 1, to: 2 }] });
  const route = R.shortestRoute(g, { lat: p(0, 2)[0], lng: p(0, 2)[1] }, { lat: p(0, 5)[0], lng: p(0, 5)[1] });
  assert.ok(Math.abs(route.distance - 33) < 2, String(route.distance));
});

test('dữ liệu rỗng / sai không làm crash', () => {
  const g = R.buildGraphFromEdges({ nodes: [], edges: [{ from: 1, to: 2 }] });
  assert.equal(g.segments.length, 0);
  assert.equal(R.nearestProjection(g, [NaN, 1]), null);
  assert.equal(R.buildGraphFromOsm(null).segments.length, 0);
});

test('cửa nằm cách đường vài mét: tuyến được nối tới đúng cửa và báo endGap', () => {
  const nodes = [{ id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 10)[0], lng: p(0, 10)[1] }];
  const g = R.buildGraphFromEdges({ nodes, edges: [{ from: 1, to: 2 }] });
  const door = { lat: p(0, 8)[0] + 0.00005, lng: p(0, 8)[1] }; // ~5,5 m lệch khỏi đường
  const route = R.shortestRoute(g, { lat: p(0, 0)[0], lng: p(0, 0)[1] }, door);
  const last = route.coords[route.coords.length - 1];
  assert.ok(Math.abs(last[0] - door.lat) < 1e-9 && Math.abs(last[1] - door.lng) < 1e-9, 'tuyến phải kết thúc đúng tại cửa');
  assert.ok(route.endGap > 4 && route.endGap < 7, String(route.endGap));
  assert.ok(route.distance > 88 + route.endGap - 3, String(route.distance));
});

test('hai cửa: cửa sát đường thắng cửa nằm xa đường dù đoạn đi trên đường ngắn hơn một chút', () => {
  const nodes = [{ id: 1, lat: p(0, 0)[0], lng: p(0, 0)[1] }, { id: 2, lat: p(0, 10)[0], lng: p(0, 10)[1] }];
  const g = R.buildGraphFromEdges({ nodes, edges: [{ from: 1, to: 2 }] });
  const start = { lat: p(0, 0)[0], lng: p(0, 0)[1] };
  const far = { lat: p(0, 7)[0] + 0.00015, lng: p(0, 7)[1] };  // 7 ô theo đường + ~16 m ra khỏi đường
  const near = { lat: p(0, 8)[0] + 0.00001, lng: p(0, 8)[1] }; // 8 ô theo đường + ~1 m
  const total = r => r.cost + r.endGap;
  const rFar = R.shortestRoute(g, start, far), rNear = R.shortestRoute(g, start, near);
  assert.ok(rFar.cost < rNear.cost, 'chỉ tính đoạn trên đường thì cửa xa đường "thắng" (lỗi cũ)');
  assert.ok(total(rNear) < total(rFar), 'tính cả đoạn tới cửa thì cửa sát đường thắng');
});
