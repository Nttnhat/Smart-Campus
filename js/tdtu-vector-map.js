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

  // Official TDTU place catalogue. Names/aliases follow the Discovery campus map.
  // Coordinates represent the practical access side of each place, so routing ends on a walkable approach.
  // Nạp từ database thật qua api/places.php (xem loadOfficialPlaces() cuối file) thay vì khai báo
  // cứng trong code. Mảng giữ nguyên reference này để mọi closure khác (searchCampus, resolvePlaceAtPoint,
  // drawOfficialLabels, admin.js...) tự thấy dữ liệu mới mà không cần sửa chỗ nào khác - chỉ cần
  // gọi VM.loadOfficialPlaces() và chờ xong trước khi dùng.
  const OFFICIAL_PLACES = [];
  // Đã bỏ overpass.kumi.systems: mirror này luôn bị chặn CORS khi gọi từ localhost (xác nhận qua
  // nhiều lần test thực tế), giữ lại chỉ tốn thời gian thử vô ích. Thứ tự còn lại xếp theo độ ổn
  // định quan sát được trong quá trình phát triển.
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];
  const OVERPASS_TIMEOUT_MS = 9000;
  const OVERPASS_LAST_GOOD_KEY = 'tdtu_overpass_last_good';

  // Mirror vừa gọi thành công được nhớ lại (sessionStorage) và thử trước tiên ở lần gọi sau trong
  // cùng phiên trình duyệt - tránh lặp lại việc đụng những mirror đang lỗi mỗi lần tải dữ liệu mới.
  function orderedOverpassEndpoints() {
    let lastGood = null;
    try { lastGood = sessionStorage.getItem(OVERPASS_LAST_GOOD_KEY); } catch (_) { lastGood = null; }
    if (!lastGood || !OVERPASS_ENDPOINTS.includes(lastGood)) return OVERPASS_ENDPOINTS;
    return [lastGood, ...OVERPASS_ENDPOINTS.filter(e => e !== lastGood)];
  }

  function rememberOverpassSuccess(endpoint) {
    try { sessionStorage.setItem(OVERPASS_LAST_GOOD_KEY, endpoint); } catch (_) { /* bỏ qua */ }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function normalise(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  function haversine(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad;
    const dLng = (b[1] - a[1]) * rad;
    const lat1 = a[0] * rad;
    const lat2 = b[0] * rad;
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }

  async function overpass(query, signal) {
    let lastError = null;
    for (const endpoint of orderedOverpassEndpoints()) {
      // Mỗi endpoint có timeout riêng (OVERPASS_TIMEOUT_MS): nếu bị treo/chậm thì bỏ qua và
      // thử endpoint tiếp theo, thay vì bỏ cuộc toàn bộ. Chỉ bỏ cuộc thật nếu người gọi
      // (caller) tự huỷ qua `signal` bên ngoài.
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(), OVERPASS_TIMEOUT_MS);
      const onExternalAbort = () => timeoutController.abort();
      if (signal) signal.addEventListener('abort', onExternalAbort);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          signal: timeoutController.signal,
          headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
          body: `data=${encodeURIComponent(query)}`
        });
        if (!response.ok) throw new Error(`Overpass ${response.status}`);
        rememberOverpassSuccess(endpoint);
        return await response.json();
      } catch (error) {
        if (signal && signal.aborted) throw error;
        lastError = error;
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
      }
    }
    throw lastError || new Error('OverpassUnavailable');
  }

  function wayGeometry(element) {
    return (element.geometry || []).map(p => [p.lat, p.lon]);
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

  async function searchCampus(query, signal) {
    const q = String(query || '').trim();
    const found = officialSearch(q);

    const seen = new Set();
    return found.filter(item => {
      const key = `${normalise(item.name)}|${Number(item.lat).toFixed(5)}|${Number(item.lng).toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0, q ? 20 : 35);
  }



  let walkGraphPromise = null;

  function projectPointToSegment(point, a, b) {
    // Equirectangular projection is sufficiently accurate at campus scale.
    const lat0 = point[0] * Math.PI / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(lat0);
    const px = point[1] * mPerDegLng, py = point[0] * mPerDegLat;
    const ax = a[1] * mPerDegLng, ay = a[0] * mPerDegLat;
    const bx = b[1] * mPerDegLng, by = b[0] * mPerDegLat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx*dx + dy*dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / len2)) : 0;
    const x = ax + t*dx, y = ay + t*dy;
    return {
      t,
      point:[y/mPerDegLat, x/mPerDegLng],
      distance:Math.hypot(px-x, py-y)
    };
  }

  function pointInPolygon(point, polygon) {
    const x=point[1], y=point[0]; let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const xi=polygon[i][1], yi=polygon[i][0], xj=polygon[j][1], yj=polygon[j][0];
      const intersect=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);
      if(intersect) inside=!inside;
    }
    return inside;
  }
  function orient(a,b,c){return (b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);}
  function segmentsIntersect(a,b,c,d){
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    return (o1*o2<0 && o3*o4<0);
  }
  function routeFactor(tags){
    const h=tags.highway||'';
    if(h==='pedestrian')return 0.96;
    if(h==='footway')return 1.00;
    if(h==='service')return 1.04;
    if(h==='living_street')return 1.08;
    if(h==='residential'||h==='unclassified')return 1.14;
    if(h==='path')return 1.32;
    if(h==='steps')return 1.55;
    return 1.15;
  }

  async function loadWalkGraph(options = {}) {
    if (walkGraphPromise && !options.force) return walkGraphPromise;
    walkGraphPromise = (async () => {
      // Use a wider box than the visible core so routes can reach VFIS and all TDTU facilities.
      const south = Math.min(CAMPUS_BOUNDS.getSouth(), 10.7298);
      const west  = Math.min(CAMPUS_BOUNDS.getWest(), 106.6978);
      const north = Math.max(CAMPUS_BOUNDS.getNorth(), 10.7356);
      const east  = Math.max(CAMPUS_BOUNDS.getEast(), 106.7032);
      const query = `
        [out:json][timeout:25];
        (
          way["highway"~"^(footway|path|pedestrian|service|living_street|residential|unclassified|steps)$"](${south},${west},${north},${east});
          way["building"](${south},${west},${north},${east});
          way["natural"="water"](${south},${west},${north},${east});
          way["waterway"](${south},${west},${north},${east});
          way["barrier"~"^(fence|wall)$"](${south},${west},${north},${east});
        );
        out geom tags;
      `;
      const data = await overpass(query, options.signal);
      const elements=data.elements||[];
      const obstacles=[]; const barriers=[];
      for(const el of elements){
        const tags=el.tags||{}, pts=wayGeometry(el);
        if(pts.length<2)continue;
        if(tags.building || tags.natural==='water' || tags.waterway){ if(pts.length>=3) obstacles.push(pts); }
        if(tags.barrier==='fence'||tags.barrier==='wall') barriers.push(pts);
      }
      const nodes = new Map();
      const adjacency = new Map();
      const segments = [];
      const keyOf = p => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
      const ensure = p => { const k=keyOf(p); if(!nodes.has(k))nodes.set(k,{id:k,coords:p}); if(!adjacency.has(k))adjacency.set(k,[]); return k; };
      const addEdge=(a,b,d,cost,meta)=>adjacency.get(a).push({to:b,distance:d,cost,meta});
      const blocked=(a,b)=>{
        const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
        if(obstacles.some(poly=>pointInPolygon(mid,poly))) return true;
        for(const line of barriers){ for(let i=0;i<line.length-1;i++){ if(segmentsIntersect(a,b,line[i],line[i+1])) return true; } }
        return false;
      };

      for (const el of elements) {
        const tags=el.tags||{}; if(!tags.highway)continue;
        if(tags.access==='no'||tags.access==='private'||tags.foot==='no')continue;
        const pts=wayGeometry(el); if(pts.length<2)continue;
        const meta={wayId:el.id,highway:tags.highway||'',name:tags.name||'',surface:tags.surface||''};
        const oneWay=false; const factor=routeFactor(tags);
        for(let i=0;i<pts.length-1;i++){
          const a=pts[i],b=pts[i+1]; if(blocked(a,b))continue;
          const ka=ensure(a),kb=ensure(b),d=haversine(a,b); if(!Number.isFinite(d)||d<.05)continue;
          const cost=d*factor; addEdge(ka,kb,d,cost,meta); if(!oneWay)addEdge(kb,ka,d,cost,meta);
          segments.push({a:ka,b:kb,aCoords:a,bCoords:b,distance:d,cost,meta,bidirectional:!oneWay});
        }
      }
      return {nodes, adjacency, segments};
    })();
    try { return await walkGraphPromise; }
    catch (e) { walkGraphPromise = null; throw e; }
  }

  function nearestGraphProjection(graph, point, maxDistance = 120) {
    let best=null;
    for (const seg of graph.segments) {
      const p=projectPointToSegment(point,seg.aCoords,seg.bCoords);
      if (!best || p.distance < best.distance) best={...p,segment:seg};
    }
    return best && best.distance <= maxDistance ? best : null;
  }

  async function snapToWalkable(lat, lng, maxDistance = 90) {
    const graph = await loadWalkGraph();
    const p = nearestGraphProjection(graph, [Number(lat), Number(lng)], maxDistance);
    return p ? {lat:p.point[0], lng:p.point[1], distance:p.distance, segment:p.segment} : null;
  }

  function makeRouteSteps(coords) {
    if (coords.length < 2) return [];
    const bearing=(a,b)=>{
      const rad=Math.PI/180, y=Math.sin((b[1]-a[1])*rad)*Math.cos(b[0]*rad);
      const x=Math.cos(a[0]*rad)*Math.sin(b[0]*rad)-Math.sin(a[0]*rad)*Math.cos(b[0]*rad)*Math.cos((b[1]-a[1])*rad);
      return (Math.atan2(y,x)*180/Math.PI+360)%360;
    };
    const delta=(a,b)=>((b-a+540)%360)-180;
    const steps=[];
    let segStart=0, segDistance=0;
    for(let i=1;i<coords.length;i++) {
      segDistance += haversine(coords[i-1],coords[i]);
      if (i < coords.length-1) {
        const d=delta(bearing(coords[i-1],coords[i]), bearing(coords[i],coords[i+1]));
        if (Math.abs(d) >= 28) {
          steps.push({
            distance:segDistance,
            duration:segDistance/1.35,
            name:'Đường nội bộ TDTU',
            maneuver:{type:steps.length?'turn':'depart', modifier:d>0?'right':'left', location:[coords[i][1],coords[i][0]]}
          });
          segStart=i; segDistance=0;
        }
      }
    }
    const last=coords[coords.length-1];
    if (segDistance > 0) steps.push({distance:segDistance,duration:segDistance/1.35,name:'Đường nội bộ TDTU',maneuver:{type:steps.length?'turn':'depart',modifier:'straight',location:[last[1],last[0]]}});
    steps.push({distance:0,duration:0,name:'Điểm đến',maneuver:{type:'arrive',modifier:'straight',location:[last[1],last[0]]}});
    return steps;
  }

  function simplifyCollinear(coords, angleTolerance = 8) {
    if (coords.length <= 2) return coords.slice();
    const bearing=(a,b)=>{
      const x=(b[1]-a[1])*Math.cos(((a[0]+b[0])/2)*Math.PI/180);
      const y=b[0]-a[0];
      return Math.atan2(y,x)*180/Math.PI;
    };
    const out=[coords[0]];
    for(let i=1;i<coords.length-1;i++) {
      let d=Math.abs((((bearing(coords[i-1],coords[i+1])-bearing(coords[i-1],coords[i]))+540)%360)-180);
      if (d >= angleTolerance) out.push(coords[i]);
    }
    out.push(coords[coords.length-1]);
    return out;
  }

  async function shortestWalkRoute(startPoint, endPoint, options = {}) {
    const graph = await loadWalkGraph(options);
    const start=[Number(startPoint.lat),Number(startPoint.lng)];
    const end=[Number(endPoint.lat),Number(endPoint.lng)];
    const sp=nearestGraphProjection(graph,start);
    const ep=nearestGraphProjection(graph,end);
    if (!sp || !ep) throw new Error('NoWalkNetwork');

    // Clone only adjacency arrays; original graph remains cached.
    const adj=new Map();
    for (const [k,v] of graph.adjacency) adj.set(k,v.slice());
    const coordsById=new Map();
    for (const [k,v] of graph.nodes) coordsById.set(k,v.coords);
    const S='__route_start__', E='__route_end__';
    adj.set(S,[]); adj.set(E,[]); coordsById.set(S,sp.point); coordsById.set(E,ep.point);
    const connectProjection=(id,p)=>{
      const s=p.segment;
      const da=s.distance*p.t, db=s.distance*(1-p.t);
      const factor=(s.cost||s.distance)/Math.max(s.distance,0.001);
      adj.get(id).push({to:s.a,distance:da,cost:da*factor});
      adj.get(id).push({to:s.b,distance:db,cost:db*factor});
      adj.get(s.a).push({to:id,distance:da,cost:da*factor});
      adj.get(s.b).push({to:id,distance:db,cost:db*factor});
    };
    connectProjection(S,sp); connectProjection(E,ep);

    // If both projections lie on the same physical segment, allow the direct along-segment path.
    const sameSeg = (sp.segment.a===ep.segment.a && sp.segment.b===ep.segment.b) || (sp.segment.a===ep.segment.b && sp.segment.b===ep.segment.a);
    if (sameSeg) {
      const d=haversine(sp.point,ep.point);
      adj.get(S).push({to:E,distance:d,cost:d}); adj.get(E).push({to:S,distance:d,cost:d});
    }

    const g=new Map([[S,0]]), f=new Map([[S,haversine(sp.point,ep.point)]]), prev=new Map();
    const open=new Set([S]);
    while(open.size) {
      let current=null,best=Infinity;
      for(const id of open){const val=f.get(id)??Infinity;if(val<best){best=val;current=id;}}
      if(current===E) break;
      open.delete(current);
      for(const edge of (adj.get(current)||[])) {
        const tentative=(g.get(current)??Infinity)+(edge.cost ?? edge.distance);
        if(tentative < (g.get(edge.to)??Infinity)) {
          prev.set(edge.to,current); g.set(edge.to,tentative);
          f.set(edge.to,tentative+haversine(coordsById.get(edge.to),ep.point)); open.add(edge.to);
        }
      }
    }
    if(!prev.has(E) && S!==E) throw new Error('NoCampusWalkRoute');
    const ids=[]; let cur=E; ids.unshift(cur);
    while(cur!==S){cur=prev.get(cur); if(!cur) throw new Error('BrokenWalkRoute'); ids.unshift(cur);}
    let coords=ids.map(id=>coordsById.get(id));
    coords=simplifyCollinear(coords,6);
    let networkDistance=0;
    for(let i=1;i<coords.length;i++) networkDistance+=haversine(coords[i-1],coords[i]);
    const total=networkDistance;
    const steps=makeRouteSteps(coords);
    return {
      distance:total,
      duration:total/1.35,
      geometry:{type:'LineString',coordinates:coords.map(([lat,lng])=>[lng,lat])},
      legs:[{steps}],
      snap:{start:sp,end:ep},
      source:'tdtu-walk-graph'
    };
  }
  // Chỉ gán nhãn cho: tòa nhà, khu vực (kể cả thể thao/trường trực thuộc), cổng, hầm xe.
  // Các danh mục khác (ăn uống, mua sắm, phòng ban...) có trong dữ liệu nhưng không hiện nhãn mặc định
  // để tránh rối bản đồ - admin có thể bật thêm sau qua danh sách categories truyền vào.
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
      marker.bindTooltip(place.name,{permanent:true,direction:'top',offset:[0,-6],className:'tdtu-place-label'});
      marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.category)}`);
      marker.addTo(group); entries.push({marker,place});
    });
    const update=()=>{const show=map.getZoom()>=17; group.eachLayer(layer=>{if(layer.getTooltip()){const el=layer.getTooltip().getElement(); if(el)el.style.display=show?'':'none';}});};
    map.on('zoomend',update); setTimeout(update,0);
    // Ô bật/tắt nhãn: bỏ tick là ẩn toàn bộ group nhãn (marker + chữ).
    L.control.layers(null, {'Nhãn địa điểm': group}, {position:'topright', collapsed:false}).addTo(map);
    return {group,entries};
  }

  function createBaseMap(elementId, options = {}) {
    const map = L.map(elementId, {
      zoomControl:false,
      minZoom:17,
      maxZoom:19,
      maxBounds:CAMPUS_BOUNDS,
      maxBoundsViscosity:1.0,
      preferCanvas:true,
      attributionControl:false,
      ...options
    }).setView(CAMPUS_CENTER, 18);

    // Không dùng tile raster bên ngoài (không chữ, không nhãn baked-in).
    // Nền gần trắng giống Google Maps thật; hình khối thật vẽ bằng drawSketchBasemap().
    map.setMinZoom(Math.max(17, map.getBoundsZoom(CAMPUS_BOUNDS)));
    map.getContainer().style.background = '#f2efe9';
    L.control.attribution({prefix:false}).addAttribution('Phác thảo dựa trên dữ liệu OpenStreetMap').addTo(map);

    return map;
  }

  // Hai mảng này từng được drawSketchBasemap() tính từ polygon OSM để resolvePlaceAtPoint() phân loại
  // điểm bấm trên bản đồ là tòa nhà/cây xanh nào. Lớp sketch đã bỏ nên tạm để rỗng; nếu cần khôi phục
  // khả năng phân loại theo polygon thì phải nạp dữ liệu building/green riêng, không qua sketch nữa.
  const greenAreas = [];
  const buildingAreas = [];

  // Nền bản đồ thật duy nhất: OpenStreetMap. Từng có thêm lớp vệ tinh Esri làm lựa chọn phụ, nhưng
  // ảnh vệ tinh bị lệch tọa độ so với thực tế (lỗi hiệu chỉnh của Esri) nên đã bỏ, chỉ giữ OSM.
  function addRealBasemap(map) {
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    });
    osm.addTo(map);
    return osm;
  }

  let officialPlacesPromise = null;
  // Gọi 1 lần lúc khởi tạo trang (navigation.js/campus-map.js/admin.js), chờ xong rồi mới vẽ
  // nhãn/tìm kiếm. Gọi lại lần 2 trả về đúng promise cũ, không fetch lại. Lỗi mạng/API thì giữ
  // mảng rỗng và báo console.warn thay vì crash trang.
  async function loadOfficialPlaces() {
    if (officialPlacesPromise) return officialPlacesPromise;
    officialPlacesPromise = (async () => {
      try {
        const res = await fetch('api/places.php');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
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
  // Lối vào đọc từ database (api/entrances.php) theo tòa, cache theo slug trong phiên trang. Lỗi
  // mạng/API thì rơi về window.Entrances (file tĩnh js/lib/entrances.js) nếu có, để routing vẫn
  // hoạt động được thay vì mất hẳn tính năng.
  async function entrancesFor(buildingSlug) {
    if (entrancesCache.has(buildingSlug)) return entrancesCache.get(buildingSlug);
    let list = [];
    try {
      const res = await fetch(`api/entrances.php?building=${encodeURIComponent(buildingSlug)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      list = data.results || [];
    } catch (error) {
      console.warn(`Không tải được lối vào từ database cho "${buildingSlug}", dùng dữ liệu tĩnh:`, error);
      list = window.Entrances ? window.Entrances.entrancesFor(buildingSlug) : [];
    }
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
    shortestWalkRoute,
    nearestGraphProjection,
    snapToWalkable,
    loadOfficialPlaces,
    entrancesFor,
    nearestEntranceFor
  };
})();
