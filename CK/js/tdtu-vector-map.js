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
  const OFFICIAL_PLACES = [
    {id:'toa-a', name:'Tòa A', aliases:['nha a','giang duong a','toa a'], category:'Tòa nhà', lat:10.73186, lng:106.69920},
    {id:'toa-b', name:'Tòa B', aliases:['nha b','giang duong b','toa b'], category:'Tòa nhà', lat:10.73224, lng:106.69899},
    {id:'toa-c', name:'Tòa C', aliases:['nha c','giang duong c','toa c'], category:'Tòa nhà', lat:10.73141, lng:106.69930},
    {id:'toa-d', name:'Tòa D', aliases:['nha d','giang duong d','toa d'], category:'Tòa nhà', lat:10.73250, lng:106.69858},
    {id:'toa-e', name:'Tòa E', aliases:['nha e','giang duong e','toa e'], category:'Tòa nhà', lat:10.73262, lng:106.69884},
    {id:'toa-f', name:'Tòa F', aliases:['nha f','giang duong f','toa f'], category:'Tòa nhà', lat:10.73078, lng:106.69894},
    {id:'toa-g', name:'Tòa G - Thư viện truyền cảm hứng', aliases:['toa g','nha g','thu vien','thu vien truyen cam hung'], category:'Tòa nhà · Thư viện', lat:10.73086, lng:106.69940},
    {id:'nha-h', name:'Nhà H', aliases:['toa h','nha h','ky tuc xa h','ktx h'], category:'Ký túc xá', lat:10.73248, lng:106.69995},
    {id:'nha-i', name:'Nhà I', aliases:['toa i','nha i','ky tuc xa i','ktx i'], category:'Ký túc xá', lat:10.73257, lng:106.70008},
    {id:'nha-k', name:'Nhà K', aliases:['toa k','nha k','ky tuc xa k','ktx k'], category:'Ký túc xá', lat:10.73266, lng:106.69796},
    {id:'nha-l', name:'Nhà L', aliases:['toa l','nha l','ky tuc xa l','ktx l'], category:'Ký túc xá', lat:10.73271, lng:106.69776},
    {id:'vfis', name:'Trường Quốc tế Việt Nam - Phần Lan (VFIS)', aliases:['vfis','truong vfis','viet nam phan lan','truong quoc te viet nam phan lan'], category:'Trường trực thuộc', lat:10.73245, lng:106.69502},
    {id:'qpan', name:'Trung tâm Quốc phòng', aliases:['trung tam qp','trung tam quoc phong','qpan','quoc phong'], category:'Khu vực', lat:10.73238, lng:106.69766},
    {id:'san-qpan', name:'Sân quốc phòng', aliases:['san quoc phong','san qpan'], category:'Khu vực', lat:10.73125, lng:106.69810},
    {id:'nha-thi-dau', name:'Nhà thi đấu', aliases:['nha thi dau','gym','nha the thao'], category:'Thể thao', lat:10.73185, lng:106.69792},
    {id:'san-van-dong', name:'Sân vận động', aliases:['san van dong','san bong da'], category:'Thể thao', lat:10.73205, lng:106.69772},
    {id:'ho-boi', name:'Hồ bơi', aliases:['ho boi','be boi'], category:'Thể thao', lat:10.73245, lng:106.69786},
    {id:'ho-boi-moi', name:'Hồ bơi mới', aliases:['ho boi moi','be boi moi'], category:'Thể thao', lat:10.73233, lng:106.69798},
    {id:'san-golf', name:'Sân tập golf', aliases:['san tap golf','golf'], category:'Thể thao', lat:10.73455, lng:106.70015},
    {id:'vuon-uom', name:'Vườn ươm', aliases:['vuon uom','nha kinh'], category:'Khu vực', lat:10.73515, lng:106.70070},
    {id:'tuong-dai', name:'Tượng đài Chủ tịch Tôn Đức Thắng', aliases:['tuong dai','tuong ton duc thang','tuong dai ton duc thang'], category:'Điểm mốc', lat:10.73192, lng:106.69952},
    {id:'7-eleven', name:'7-Eleven', aliases:['7 eleven','seven eleven','cua hang tien loi'], category:'Tiện ích', lat:10.73063, lng:106.69822},
    {id:'phong-y-te', name:'Phòng y tế', aliases:['phong y te','y te'], category:'Tiện ích', lat:10.73135, lng:106.69788},
    {id:'tram-dien', name:'Trạm điện', aliases:['tram dien'], category:'Hạ tầng', lat:10.73055, lng:106.69972},
  ];
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

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
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
          body: `data=${encodeURIComponent(query)}`
        });
        if (!response.ok) throw new Error(`Overpass ${response.status}`);
        return await response.json();
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
      }
    }
    throw lastError || new Error('OverpassUnavailable');
  }

  function wayGeometry(element) {
    return (element.geometry || []).map(p => [p.lat, p.lon]);
  }

  function roadStyle(tags) {
    const highway = tags.highway || '';
    if (['footway','path','pedestrian','steps'].includes(highway)) {
      return {color:'#2f855a', weight:4, opacity:.95, dashArray: highway === 'steps' ? '5 5' : null};
    }
    if (['service','living_street'].includes(highway)) {
      return {color:'#64748b', weight:6, opacity:.8};
    }
    if (['residential','unclassified','tertiary'].includes(highway)) {
      return {color:'#94a3b8', weight:7, opacity:.65};
    }
    return {color:'#9aa7b6', weight:4, opacity:.55};
  }

  async function drawCampusVectors(map, options = {}) {
    const south = CAMPUS_BOUNDS.getSouth();
    const west = CAMPUS_BOUNDS.getWest();
    const north = CAMPUS_BOUNDS.getNorth();
    const east = CAMPUS_BOUNDS.getEast();
    const query = `
      [out:json][timeout:20];
      (
        way["building"](${south},${west},${north},${east});
        way["highway"](${south},${west},${north},${east});
        way["natural"="water"](${south},${west},${north},${east});
        way["waterway"](${south},${west},${north},${east});
        way["leisure"~"^(pitch|sports_centre|stadium)$"](${south},${west},${north},${east});
      );
      out geom tags;
    `;

    const layers = L.layerGroup().addTo(map);
    try {
      const data = await overpass(query, options.signal);
      const elements = data.elements || [];
      elements.forEach(el => {
        const pts = wayGeometry(el);
        if (pts.length < 2) return;
        const tags = el.tags || {};
        if (tags.building) {
          L.polygon(pts, {
            color:'#56708d', weight:1.2, fillColor:'#dbe5ef', fillOpacity:.42, interactive:false
          }).addTo(layers);
          return;
        }
        if (tags.natural === 'water' || tags.waterway) {
          L.polygon(pts, {
            color:'#6aa7c8', weight:1, fillColor:'#bfe5f3', fillOpacity:.48, interactive:false
          }).addTo(layers);
          return;
        }
        if (tags.leisure) {
          L.polygon(pts, {
            color:'#3e8f5c', weight:1, fillColor:'#bde0b8', fillOpacity:.45, interactive:false
          }).addTo(layers);
          return;
        }
        if (tags.highway) {
          L.polyline(pts, {...roadStyle(tags), interactive:false}).addTo(layers);
        }
      });
      return {layers, source:'overpass', count:elements.length};
    } catch (error) {
      console.warn('Không tải được vector OSM chi tiết:', error);
      return {layers, source:'fallback', count:0, error};
    }
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

    // Supplement the curated campus catalogue with live OSM objects.
    if (q) {
      const south = CAMPUS_BOUNDS.getSouth(), west = CAMPUS_BOUNDS.getWest();
      const north = CAMPUS_BOUNDS.getNorth(), east = CAMPUS_BOUNDS.getEast();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const overpassQuery = `
        [out:json][timeout:12];
        (
          nwr["name"~"${escaped}",i](${south},${west},${north},${east});
          nwr["official_name"~"${escaped}",i](${south},${west},${north},${east});
          nwr["short_name"~"${escaped}",i](${south},${west},${north},${east});
        );
        out center tags 30;
      `;
      try {
        const data = await overpass(overpassQuery, signal);
        for (const el of (data.elements || [])) {
          const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
          const name = el.tags?.name || el.tags?.official_name || el.tags?.short_name;
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) continue;
          const nn=normalise(name), nq=normalise(q);
          let score=20;
          if(nn===nq)score+=500; else if(nn.startsWith(nq))score+=260; else if(nn.includes(nq))score+=180;
          found.push({name,lat:Number(lat),lng:Number(lng),detail:'Địa điểm bổ sung từ OpenStreetMap',source:'OSM object',score});
        }
      } catch (_) {}
    }

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
        const oneWay=tags.oneway==='yes'||tags.oneway==='1'; const factor=routeFactor(tags);
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
  async function drawNativeMapLabels(map, options = {}) {
    const group = L.layerGroup().addTo(map);
    const south = CAMPUS_BOUNDS.getSouth(), west = CAMPUS_BOUNDS.getWest();
    const north = CAMPUS_BOUNDS.getNorth(), east = CAMPUS_BOUNDS.getEast();
    const query = `
      [out:json][timeout:18];
      (
        nwr["name"](${south},${west},${north},${east});
      );
      out center tags 300;
    `;

    try {
      const data = await overpass(query, options.signal);
      const seen = new Set();
      (data.elements || []).forEach(el => {
        const tags = el.tags || {};
        const name = tags.name;
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // Keep campus-relevant POI/building/area labels. Road names remain rendered by the base map.
        const useful = Boolean(
          tags.building || tags.amenity || tags.leisure || tags.shop || tags.office ||
          tags.tourism || tags.sport || tags.landuse || tags.man_made || tags.historic ||
          tags.place || tags.school || tags.university
        );
        if (!useful) return;

        const key = `${normalise(name)}|${Number(lat).toFixed(5)}|${Number(lng).toFixed(5)}`;
        if (seen.has(key)) return;
        seen.add(key);

        const anchor = L.circleMarker([lat,lng], {
          radius: 1,
          stroke: false,
          fillOpacity: 0,
          opacity: 0,
          interactive: false
        }).addTo(group);
        anchor.bindTooltip(escapeHtml(name), {
          permanent: true,
          direction: 'center',
          className: 'native-osm-label',
          opacity: 1
        });
      });
      return {group, source:'osm-names', count:seen.size};
    } catch (error) {
      console.warn('Không tải được lớp tên gốc OSM:', error);
      return {group, source:'fallback', count:0, error};
    }
  }

  function drawOfficialLabels(map) {
    const group=L.layerGroup().addTo(map);
    const entries=[];
    OFFICIAL_PLACES.forEach(place=>{
      if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng))return;
      const marker=L.circleMarker([place.lat,place.lng],{radius:3,color:'#00458C',weight:2,fillColor:'#fff',fillOpacity:1,interactive:true});
      marker.bindTooltip(place.name,{permanent:true,direction:'top',offset:[0,-5],className:'tdtu-place-label'});
      marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.category)}`);
      marker.addTo(group); entries.push({marker,place});
    });
    const update=()=>{const show=map.getZoom()>=18; group.eachLayer(layer=>{if(layer.getTooltip()){const el=layer.getTooltip().getElement(); if(el)el.style.display=show?'':'none';}});};
    map.on('zoomend',update); setTimeout(update,0);
    return {group,entries};
  }

  function createBaseMap(elementId, options = {}) {
    const map = L.map(elementId, {
      zoomControl:false,
      minZoom:16,
      maxZoom:21,
      maxBounds:CAMPUS_BOUNDS.pad(.15),
      preferCanvas:true,
      ...options
    }).setView(CAMPUS_CENTER, 18);

    // Accurate geographic base. Labels are kept subtle; TDTU labels/search are controlled separately.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:21,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);

    return map;
  }

  window.TDTUVectorMap = {
    CAMPUS_BOUNDS,
    CORE_BOUNDS,
    CAMPUS_CENTER,
    OFFICIAL_PLACES,
    normalise,
    escapeHtml,
    haversine,
    createBaseMap,
    drawCampusVectors,
    searchCampus,
    officialSearch,
    drawOfficialLabels,
    drawNativeMapLabels,
    loadWalkGraph,
    shortestWalkRoute,
    nearestGraphProjection,
    snapToWalkable
  };
})();
