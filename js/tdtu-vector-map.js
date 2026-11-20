(function () {
  // Whole TDTU campus extent, including VFIS / garden / sports zones.
  const CAMPUS_BOUNDS = L.latLngBounds(
    [10.7288, 106.6940],
    [10.7365, 106.7040]
  );
  const CORE_BOUNDS = L.latLngBounds(
    [10.73045, 106.69755],
    [10.73335, 106.70035]
  );
  const CAMPUS_CENTER = [10.73205, 106.69910];
  const Router = window.WalkRouter;

  // Danh mục địa điểm nạp từ database qua api/places.php (xem loadOfficialPlaces()). Mảng giữ nguyên
  // reference để mọi closure khác (searchCampus, resolvePlaceAtPoint, drawOfficialLabels, admin.js...)
  // tự thấy dữ liệu mới.
  const OFFICIAL_PLACES = [];
  // Chỉ dùng khi cả api/road-graph.php lẫn api/osm-campus.php đều lỗi (vd mở bằng Live Server không có PHP).
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];
  const OVERPASS_TIMEOUT_MS = 9000;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function normalise(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  const haversine = Router.haversine;

  async function fetchJson(url, { signal, timeoutMs = 12000, init = {} } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  async function overpassDirect(signal) {
    const b = `${CAMPUS_BOUNDS.getSouth()},${CAMPUS_BOUNDS.getWest()},${CAMPUS_BOUNDS.getNorth()},${CAMPUS_BOUNDS.getEast()}`;
    const query = `[out:json][timeout:25];(way["highway"](${b});way["building"](${b});way["barrier"~"^(fence|wall)$"](${b}););out geom tags;`;
    let lastError = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        return await fetchJson(endpoint, {
          signal, timeoutMs: OVERPASS_TIMEOUT_MS,
          init: { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}, body: `data=${encodeURIComponent(query)}` }
        });
      } catch (error) {
        if (signal && signal.aborted) throw error;
        lastError = error;
      }
    }
    throw lastError || new Error('OverpassUnavailable');
  }

  function officialSearch(query) {
    const nq = normalise(query);
    const items = OFFICIAL_PLACES.map(item => {
      const hay = [item.name, ...(item.aliases || []), item.category].map(normalise);
      let score = 0;
      if (!nq) score = 30;
      else if (normalise(item.name) === nq || (item.aliases || []).some(a => normalise(a) === nq)) score = 220;
      else if (hay.some(v => v.startsWith(nq))) score = 170;
      else if (hay.some(v => v.includes(nq))) score = 130;
      return {...item, detail:`${item.category} · Trường Đại học Tôn Đức Thắng`, source:'TDTU official catalogue', score};
    }).filter(x => !nq || x.score > 0);
    return items.sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name,'vi'));
  }

  async function searchCampus(query) {
    const q = String(query || '').trim();
    const seen = new Set();
    return officialSearch(q).filter(item => {
      const key = `${normalise(item.name)}|${Number(item.lat).toFixed(5)}|${Number(item.lng).toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, q ? 20 : 35);
  }

  // ---------------- Đồ thị đường đi bộ ----------------
  // Nguồn chính: database (api/road-graph.php) - admin chỉnh được. Dự phòng: OSM qua
  // api/osm-campus.php (server cache + snapshot trong repo), cuối cùng mới gọi Overpass trực tiếp.
  const graphCache = new Map();
  let osmElementsPromise = null;

  function loadOsmElements(signal) {
    if (!osmElementsPromise) {
      osmElementsPromise = fetchJson('api/osm-campus.php', { signal })
        .catch(() => overpassDirect(signal))
        .then(data => data.elements || [])
        .catch(error => { osmElementsPromise = null; throw error; });
    }
    return osmElementsPromise;
  }

  async function loadDbGraph(options) {
    const data = await fetchJson('api/road-graph.php', { signal: options.signal });
    const graph = Router.buildGraphFromEdges({
      nodes: data.nodes.map(([id, lat, lng]) => ({ id, lat, lng })),
      edges: data.edges.map(([id, from, to, type, cost_factor, nameIndex]) => ({ id, from, to, type, cost_factor, name: data.names[nameIndex] || '' }))
    }, { avoidSteps: options.avoidSteps });
    if (graph.segments.length < 50) throw new Error('RoadGraphTooSmall');
    graph.source = 'database';
    return graph;
  }

  async function loadOsmGraph(options) {
    const graph = Router.buildGraphFromOsm(await loadOsmElements(options.signal), { avoidSteps: options.avoidSteps });
    if (!graph.segments.length) throw new Error('OsmGraphEmpty');
    graph.source = 'osm';
    return graph;
  }

  function cachedGraph(kind, options) {
    const key = `${kind}|${options.avoidSteps ? 1 : 0}`;
    if (!graphCache.has(key) || options.force) {
      const loader = kind === 'db' ? loadDbGraph : loadOsmGraph;
      graphCache.set(key, loader(options).catch(error => { graphCache.delete(key); throw error; }));
    }
    return graphCache.get(key);
  }

  async function loadWalkGraph(options = {}) {
    try {
      return await cachedGraph('db', options);
    } catch (error) {
      console.warn('Không tải được đồ thị đường từ database, dùng dữ liệu OSM:', error);
      return cachedGraph('osm', options);
    }
  }

  function nearestGraphProjection(graph, point, maxDistance = 120) {
    return Router.nearestProjection(graph, point, maxDistance);
  }

  async function snapToWalkable(lat, lng, maxDistance = 90, options = {}) {
    const graph = await loadWalkGraph(options);
    const p = Router.nearestProjection(graph, [Number(lat), Number(lng)], maxDistance);
    return p ? {lat:p.point[0], lng:p.point[1], distance:p.distance, segment:p.segment} : null;
  }

  // options: {avoidSteps, maxSnap}. Đồ thị database không phủ được điểm (vd khu VFIS chưa vẽ lối đi)
  // thì thử đồ thị OSM trước khi báo lỗi.
  async function shortestWalkRoute(startPoint, endPoint, options = {}) {
    const maxSnap = options.maxSnap ?? 200;
    const primary = await loadWalkGraph(options);
    try {
      return Router.shortestRoute(primary, startPoint, endPoint, { maxSnap, source: primary.source });
    } catch (error) {
      if (primary.source !== 'database') throw error;
      const fallback = await cachedGraph('osm', options);
      return Router.shortestRoute(fallback, startPoint, endPoint, { maxSnap, source: 'osm' });
    }
  }

  // Chỉ gán nhãn cho: tòa nhà, khu vực (kể cả thể thao/trường trực thuộc), cổng, hầm xe.
  const DEFAULT_LABEL_CATEGORIES = new Set([
    'Tòa nhà', 'Tòa nhà · Thư viện', 'Ký túc xá', 'Trường trực thuộc',
    'Khu vực', 'Thể thao', 'Cổng', 'Hầm xe'
  ]);

  function drawOfficialLabels(map, { categories = DEFAULT_LABEL_CATEGORIES } = {}) {
    const group=L.layerGroup().addTo(map);
    const entries=[];
    OFFICIAL_PLACES.forEach(place=>{
      if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng))return;
      if(categories && !categories.has(place.category))return;
      const marker=L.circleMarker([place.lat,place.lng],{radius:3,color:'#4285F4',weight:2,fillColor:'#fff',fillOpacity:1,interactive:true});
      marker.bindTooltip(escapeHtml(place.name),{permanent:true,direction:'top',offset:[0,-6],className:'tdtu-place-label'});
      marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.category)}`);
      marker.addTo(group); entries.push({marker,place});
    });
    const update=()=>{const show=map.getZoom()>=17; group.eachLayer(layer=>{if(layer.getTooltip()){const el=layer.getTooltip().getElement(); if(el)el.style.display=show?'':'none';}});};
    map.on('zoomend',update); setTimeout(update,0);
    L.control.layers(null, {'Nhãn địa điểm': group}, {position:'topright', collapsed:false}).addTo(map);
    return {group,entries};
  }

  function createBaseMap(elementId, options = {}) {
    const map = L.map(elementId, {
      zoomControl:false,
      minZoom:17,
      maxZoom:20,
      maxBounds:CAMPUS_BOUNDS,
      maxBoundsViscosity:1.0,
      preferCanvas:true,
      attributionControl:false,
      ...options
    }).setView(CAMPUS_CENTER, 18);

    map.setMinZoom(Math.max(17, map.getBoundsZoom(CAMPUS_BOUNDS)));
    map.getContainer().style.background = '#f2efe9';
    L.control.attribution({prefix:false}).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>').addTo(map);
    return map;
  }

  const greenAreas = [];
  const buildingAreas = [];

  // Nền OpenStreetMap lấy TRỰC TIẾP từ máy chủ tile OSM cho mọi máy - không lưu ảnh trong repo.
  // Service worker (sw.js) tự cache tile đã xem nên lần sau mở lại/mất mạng vẫn có bản đồ.
  // Lưu ý: phải mở qua http(s)://, không mở file:// (máy chủ OSM chặn request không có Referer).
  // maxNativeZoom 19 + maxZoom 20: phóng to thêm 1 mức để xem chi tiết lối đi.
  function addRealBasemap(map) {
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 20,
      crossOrigin: true,
      attribution: '© OpenStreetMap contributors'
    });
    let failures = 0;
    osm.on('tileerror', () => {
      // Lỗi tile hàng loạt (mất mạng, bị chặn) -> báo 1 lần, bản đồ vẫn dùng được với lớp đường/nhãn.
      if (++failures === 8 && map.getContainer()) map.getContainer().dataset.tilesOffline = '1';
    });
    osm.addTo(map);
    return osm;
  }

  let officialPlacesPromise = null;
  async function loadOfficialPlaces() {
    if (officialPlacesPromise) return officialPlacesPromise;
    officialPlacesPromise = (async () => {
      try {
        const data = await fetchJson('api/places.php');
        OFFICIAL_PLACES.length = 0;
        OFFICIAL_PLACES.push(...(data.results || []));
      } catch (error) {
        console.warn('Không tải được danh sách địa điểm từ database:', error);
      }
      return OFFICIAL_PLACES;
    })();
    return officialPlacesPromise;
  }

  const entrancesCache = new Map();
  // Lối vào đọc từ database (api/entrances.php) theo tòa; lỗi thì rơi về js/lib/entrances.js.
  async function entrancesFor(buildingSlug) {
    if (entrancesCache.has(buildingSlug)) return entrancesCache.get(buildingSlug);
    let list = [];
    try {
      const data = await fetchJson(`api/entrances.php?building=${encodeURIComponent(buildingSlug)}`);
      list = data.results || [];
    } catch (error) {
      console.warn(`Không tải được lối vào từ database cho "${buildingSlug}", dùng dữ liệu tĩnh:`, error);
      list = window.Entrances ? window.Entrances.entrancesFor(buildingSlug) : [];
    }
    if (!list.length && window.Entrances) list = window.Entrances.entrancesFor(buildingSlug);
    entrancesCache.set(buildingSlug, list);
    return list;
  }

  async function nearestEntranceFor(buildingSlug, lat, lng) {
    const list = await entrancesFor(buildingSlug);
    let best = null, bestDist = Infinity;
    for (const e of list) {
      const d = haversine([lat, lng], [e.lat, e.lng]);
      if (d < bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  // Chọn lối vào cho tuyến ngắn nhất từ điểm xuất phát (không phải lối vào gần tâm tòa nhất):
  // thử từng lối vào, giữ tuyến có chi phí nhỏ nhất.
  async function bestEntranceRoute(buildingSlug, startPoint, options = {}) {
    const list = await entrancesFor(buildingSlug);
    let best = null;
    for (const entrance of list) {
      try {
        const route = await shortestWalkRoute(startPoint, entrance, options);
        // Cộng cả đoạn từ đường tới cửa (endGap): cửa nằm xa lối đi không được tính "miễn phí".
        const total = route.cost + (route.endGap || 0);
        if (!best || total < best.total) best = { entrance, route, total };
      } catch (_) { /* lối vào này không nối được mạng đường, bỏ qua */ }
    }
    return best;
  }

  window.TDTUVectorMap = {
    CAMPUS_BOUNDS,
    CORE_BOUNDS,
    CAMPUS_CENTER,
    OFFICIAL_PLACES,
    greenAreas,
    buildingAreas,
    normalise,
    escapeHtml,
    haversine,
    createBaseMap,
    addRealBasemap,
    searchCampus,
    officialSearch,
    drawOfficialLabels,
    loadWalkGraph,
    loadOsmElements,
    shortestWalkRoute,
    nearestGraphProjection,
    snapToWalkable,
    loadOfficialPlaces,
    entrancesFor,
    nearestEntranceFor,
    bestEntranceRoute
  };
})();
