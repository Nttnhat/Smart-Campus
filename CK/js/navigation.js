document.addEventListener('DOMContentLoaded', () => {
  const VM = window.TDTUVectorMap;
  const ROUTING_BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
  const GOOD_ACCURACY = 15;
  const REJECT_ACCURACY = 35;
  const REROUTE_DISTANCE = 8;
  const REROUTE_INTERVAL = 4000;

  const map = VM.createBaseMap('geoNavigationMap');
  const routeLayer = L.layerGroup().addTo(map);
  const pointLayer = L.layerGroup().addTo(map);
  const gpsLayer = L.layerGroup().addTo(map);

  const els = {
    resetRoute: document.getElementById('resetRoute'),
    startModeSwitch: document.getElementById('startModeSwitch'),
    gpsModePanel: document.getElementById('gpsModePanel'),
    manualModePanel: document.getElementById('manualModePanel'),
    toggleTracking: document.getElementById('toggleTracking'),
    gpsDot: document.getElementById('gpsDot'),
    gpsStatus: document.getElementById('gpsStatus'),
    gpsAccuracy: document.getElementById('gpsAccuracy'),
    startSearchInput: document.getElementById('startSearchInput'),
    startSearch: document.getElementById('searchStart'),
    startSuggestions: document.getElementById('startSearchSuggestions'),
    pickManualStart: document.getElementById('pickManualStart'),
    manualStartName: document.getElementById('manualStartName'),
    manualStartCoords: document.getElementById('manualStartCoords'),
    destinationInput: document.getElementById('destinationInput'),
    destinationSearch: document.getElementById('searchDestination'),
    destinationSuggestions: document.getElementById('searchSuggestions'),
    pickDestination: document.getElementById('pickDestination'),
    destinationName: document.getElementById('destinationName'),
    destinationCoords: document.getElementById('destinationCoords'),
    startRoute: document.getElementById('startRoute'),
    routeTitle: document.getElementById('routeTitle'),
    routeDistance: document.getElementById('routeDistance'),
    routeTime: document.getElementById('routeTime'),
    routeRemaining: document.getElementById('routeRemaining'),
    routeStateBadge: document.getElementById('routeStateBadge'),
    emptyRoute: document.getElementById('emptyRoute'),
    navigationActions: document.getElementById('navigationActions'),
    beginNavigation: document.getElementById('beginNavigation'),
    voiceToggle: document.getElementById('voiceToggle'),
    routeSteps: document.getElementById('routeSteps'),
    navigationBanner: document.getElementById('navigationBanner'),
    navTurnIcon: document.getElementById('navTurnIcon'),
    navDistanceToTurn: document.getElementById('navDistanceToTurn'),
    navInstruction: document.getElementById('navInstruction'),
    navStreet: document.getElementById('navStreet'),
    endNavigation: document.getElementById('endNavigation'),
    followMe: document.getElementById('followMe'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    zoomValue: document.getElementById('zoomValue'),
    currentLocationName: document.getElementById('currentLocationName'),
    currentLocationDetail: document.getElementById('currentLocationDetail'),
    currentCoordinates: document.getElementById('currentCoordinates'),
    mapClickHint: document.getElementById('mapClickHint'),
    vectorStatus: document.getElementById('vectorStatus')
  };

  let startMode = 'gps';
  let picking = null; // 'start' | 'destination'
  let manualStart = null;
  let destination = null;
  let startMarker = null;
  let destinationMarker = null;
  let gpsMarker = null;
  let accuracyCircle = null;
  let routePolyline = null;
  let routeData = null;
  let watchId = null;
  let tracking = false;
  let currentPosition = null;
  let recentSamples = [];
  let lastRoutePosition = null;
  let lastRouteAt = 0;
  let navigationActive = false;
  let followMode = true;
  let voiceEnabled = true;
  let activeSteps = [];
  let activeStepIndex = 0;
  let lastSpokenIndex = -1;
  let searchAbort = {start:null, destination:null};

  function markerIcon(type, label) {
    const cls = type === 'start' ? 'geo-start-marker' : type === 'destination' ? 'geo-destination-marker' : 'geo-gps-marker';
    return L.divIcon({
      className:'',
      html:`<div class="${cls}"><span></span><small>${VM.escapeHtml(label || '')}</small></div>`,
      iconSize:[42,48], iconAnchor:[21,42]
    });
  }

  function formatDistance(m) {
    if (!Number.isFinite(m)) return '—';
    return m >= 1000 ? `${(m/1000).toFixed(2)} km` : `${Math.round(m)} m`;
  }
  function formatTime(s) {
    if (!Number.isFinite(s)) return '—';
    const min = Math.max(1, Math.round(s/60));
    return min >= 60 ? `${Math.floor(min/60)}g ${min%60}p` : `${min} phút`;
  }

  function setBadge(text, state='') {
    els.routeStateBadge.textContent = text;
    els.routeStateBadge.dataset.state = state;
  }

  function setPicking(kind) {
    picking = kind;
    els.pickManualStart.classList.toggle('active', kind === 'start');
    els.pickDestination.classList.toggle('active', kind === 'destination');
    els.mapClickHint.textContent = kind === 'start'
      ? 'Bấm đúng vị trí trên bản đồ để đặt điểm bắt đầu'
      : kind === 'destination'
        ? 'Bấm đúng vị trí trên bản đồ để đặt điểm đến'
        : 'Chọn chế độ rồi bấm bản đồ để đặt điểm.';
  }

  async function reverseName(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1`;
      const r = await fetch(url, {headers:{'Accept-Language':'vi'}});
      if (!r.ok) throw new Error('reverse');
      const d = await r.json();
      const a = d.address || {};
      const name = d.namedetails?.name || d.name || a.building || a.university || a.amenity || a.road || 'Điểm đã chọn';
      return {name, detail:d.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`};
    } catch (_) {
      return {name:'Điểm đã chọn', detail:`${lat.toFixed(6)}, ${lng.toFixed(6)}`};
    }
  }

  async function assignPoint(kind, lat, lng, suppliedName = null, suppliedDetail = null) {
    const resolved = suppliedName ? {name:suppliedName, detail:suppliedDetail || suppliedName} : await reverseName(lat, lng);

    // Keep the REAL selected place coordinate for the marker/name.
    // Routing uses a separate walkable access coordinate so the destination never
    // visually jumps from VFIS / Vườn ươm / a building to a nearby road.
    const point = {
      lat:Number(lat),
      lng:Number(lng),
      routeLat:Number(lat),
      routeLng:Number(lng),
      name:resolved.name,
      detail:resolved.detail,
      snapDistance:0
    };
    try {
      const snapped = await VM.snapToWalkable(point.lat, point.lng, 120);
      if (snapped) {
        point.routeLat = snapped.lat;
        point.routeLng = snapped.lng;
        point.snapDistance = snapped.distance;
      }
    } catch (_) {}

    if (kind === 'start') {
      manualStart = point;
      if (startMarker) pointLayer.removeLayer(startMarker);
      startMarker = L.marker([point.lat, point.lng], {icon:markerIcon('start','Điểm đầu')}).addTo(pointLayer).bindPopup(`<strong>${VM.escapeHtml(point.name)}</strong>`);
      els.manualStartName.textContent = point.name;
      els.manualStartCoords.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      els.startSearchInput.value = point.name;
    } else {
      destination = point;
      if (destinationMarker) pointLayer.removeLayer(destinationMarker);
      destinationMarker = L.marker([point.lat, point.lng], {icon:markerIcon('destination','Điểm đến')}).addTo(pointLayer).bindPopup(`<strong>${VM.escapeHtml(point.name)}</strong>`);
      els.destinationName.textContent = point.name;
      els.destinationCoords.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      els.destinationInput.value = point.name;
    }
    map.flyTo([point.lat, point.lng], 19, {duration:.6});
    setPicking(null);
  }

  async function performSearch(kind) {
    const input = kind === 'start' ? els.startSearchInput : els.destinationInput;
    const box = kind === 'start' ? els.startSuggestions : els.destinationSuggestions;
    const q = input.value.trim();
    if (searchAbort[kind]) searchAbort[kind].abort();
    searchAbort[kind] = new AbortController();
    box.classList.add('show');
    box.innerHTML = '<div class="suggestion-loading">Đang tìm trong khuôn viên…</div>';
    try {
      const results = await VM.searchCampus(q, searchAbort[kind].signal);
      if (!results.length) {
        box.innerHTML = '<div class="suggestion-loading">Không tìm thấy tên này trong dữ liệu bản đồ. Bạn có thể bấm trực tiếp trên bản đồ.</div>';
        box.dataset.results = '[]';
        return;
      }
      box.dataset.results = JSON.stringify(results);
      box.innerHTML = results.map((r,i) => `
        <button type="button" class="suggestion-item osm-result" data-index="${i}">
          <span class="suggestion-icon">⌖</span>
          <span class="suggestion-text"><strong>${VM.escapeHtml(r.name)}</strong><small>${VM.escapeHtml(r.detail)}</small></span>
        </button>`).join('');
    } catch (e) {
      if (e.name !== 'AbortError') box.innerHTML = '<div class="suggestion-loading">Không thể tìm kiếm lúc này. Hãy chọn trực tiếp trên bản đồ.</div>';
    }
  }

  function bindSuggestionBox(kind, box) {
    box.addEventListener('click', e => {
      const item = e.target.closest('[data-index]');
      if (!item) return;
      const results = JSON.parse(box.dataset.results || '[]');
      const r = results[Number(item.dataset.index)];
      if (!r) return;
      assignPoint(kind, r.lat, r.lng, r.name, r.detail);
      box.classList.remove('show');
    });
  }

  function currentStartPoint() {
    if (startMode === 'manual') return manualStart ? {...manualStart, lat:manualStart.routeLat ?? manualStart.lat, lng:manualStart.routeLng ?? manualStart.lng} : null;
    return currentPosition ? {lat:currentPosition.lat, lng:currentPosition.lng, name:'Vị trí GPS của tôi'} : null;
  }

  async function fetchRoute(start, end) {
    // Primary router: build the shortest path directly on TDTU walkable ways.
    // This snaps to the closest point ON a segment instead of forcing the user
    // to a distant graph node, which prevents unnecessary detours.
    if (typeof VM.shortestWalkRoute === 'function') {
      try {
        return await VM.shortestWalkRoute(start, end);
      } catch (error) {
        console.warn('Campus walk graph unavailable, falling back to foot routing service:', error);
      }
    }

    // Fallback only when the campus graph cannot be loaded.
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const url = `${ROUTING_BASE}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=3&continue_straight=false`;
    const response = await fetch(url, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error(`Routing ${response.status}`);
    const data = await response.json();
    if (!data.routes?.length) throw new Error('No route');
    return [...data.routes].sort((a,b) => (a.distance-b.distance) || (a.duration-b.duration))[0];
  }

  function turnInstruction(step) {
    const m = step.maneuver || {};
    const type = m.type || '';
    const mod = m.modifier || '';
    const name = step.name || 'lối đi nội bộ';
    if (type === 'arrive') return `Đã đến ${destination?.name || 'điểm đến'}`;
    if (type === 'depart') return `Bắt đầu đi theo ${name}`;
    const dir = {
      left:'rẽ trái', right:'rẽ phải', 'slight left':'chếch trái', 'slight right':'chếch phải',
      'sharp left':'rẽ gấp trái', 'sharp right':'rẽ gấp phải', straight:'đi thẳng', uturn:'quay đầu'
    }[mod] || 'tiếp tục';
    return `${dir.charAt(0).toUpperCase()+dir.slice(1)}${name ? ` theo ${name}` : ''}`;
  }

  function turnIcon(step) {
    const mod = step?.maneuver?.modifier || 'straight';
    if (mod.includes('left')) return '↰';
    if (mod.includes('right')) return '↱';
    if (mod === 'uturn') return '↶';
    return '↑';
  }

  function renderRoute(route, fit=true) {
    routeLayer.clearLayers();
    const latlngs = route.geometry.coordinates.map(([lng,lat]) => [lat,lng]);
    // Compact route styling: visible without hiding buildings/roads underneath.
    L.polyline(latlngs, {color:'#ffffff', weight:9, opacity:.94, lineCap:'round', lineJoin:'round', smoothFactor:.35}).addTo(routeLayer);
    routePolyline = L.polyline(latlngs, {color:'#D31145', weight:5, opacity:.98, lineCap:'round', lineJoin:'round', smoothFactor:.35}).addTo(routeLayer);

    // The selected point can be a few metres away from the walkable centreline.
    // Start/end are already snapped to a valid walkable approach; no straight connector is drawn through obstacles.
    if (fit) map.fitBounds(routePolyline.getBounds(), {padding:[60,60]});

    els.routeDistance.textContent = formatDistance(route.distance);
    els.routeTime.textContent = formatTime(route.duration);
    els.routeRemaining.textContent = formatDistance(route.distance);
    els.routeTitle.textContent = `${currentStartPoint()?.name || 'Điểm đầu'} → ${destination?.name || 'Điểm đến'}`;
    els.emptyRoute.hidden = true;
    els.navigationActions.hidden = false;
    setBadge('Tuyến ngắn nhất', 'ok');

    activeSteps = route.legs?.flatMap(leg => leg.steps || []) || [];
    els.routeSteps.hidden = !activeSteps.length;
    els.routeSteps.innerHTML = activeSteps.map((step,i) => `
      <div class="route-step${i===0?' active':''}">
        <span class="step-dot">${i+1}</span>
        <div class="step-copy"><strong>${VM.escapeHtml(turnInstruction(step))}</strong><span>${formatDistance(step.distance)}</span></div>
      </div>`).join('');
  }

  async function calculateRoute({silent=false, fit=true} = {}) {
    const start = currentStartPoint();
    if (!start) {
      setBadge(startMode === 'gps' ? 'Cần GPS' : 'Chưa có điểm đầu', 'warn');
      if (!silent) alert(startMode === 'gps' ? 'Hãy bật GPS trước.' : 'Hãy chọn điểm bắt đầu.');
      return;
    }
    if (!destination) {
      setBadge('Chưa có điểm đến', 'warn');
      if (!silent) alert('Hãy chọn điểm đến.');
      return;
    }
    setBadge('Đang tính…','busy');
    try {
      const routeTarget = {...destination, lat:destination.routeLat ?? destination.lat, lng:destination.routeLng ?? destination.lng};
      const route = await fetchRoute(start, routeTarget);
      routeData = route;
      renderRoute(route, fit);
      lastRoutePosition = [start.lat,start.lng];
      lastRouteAt = Date.now();
      if (navigationActive) updateNavigationProgress();
    } catch (error) {
      console.error(error);
      setBadge('Không tìm được tuyến','error');
      if (!silent) alert('Không tìm được tuyến đi bộ hợp lệ giữa hai điểm. Hãy chọn điểm nằm gần lối đi trong khuôn viên.');
    }
  }

  function weightedPosition() {
    const usable = recentSamples.filter(s => s.accuracy <= GOOD_ACCURACY * 1.5).slice(-5);
    if (!usable.length) return recentSamples[recentSamples.length-1] || null;
    let wsum=0, lat=0, lng=0;
    usable.forEach(s => { const w=1/Math.max(3,s.accuracy); wsum+=w; lat+=s.lat*w; lng+=s.lng*w; });
    const newest = usable[usable.length-1];
    return {...newest, lat:lat/wsum, lng:lng/wsum};
  }

  function updateGpsVisual(pos) {
    if (!gpsMarker) gpsMarker = L.marker([pos.lat,pos.lng], {icon:markerIcon('gps','Bạn')}).addTo(gpsLayer);
    else gpsMarker.setLatLng([pos.lat,pos.lng]);
    if (!accuracyCircle) accuracyCircle = L.circle([pos.lat,pos.lng], {radius:pos.accuracy, color:'#0ea5e9', weight:1, fillColor:'#0ea5e9', fillOpacity:.08}).addTo(gpsLayer);
    else { accuracyCircle.setLatLng([pos.lat,pos.lng]); accuracyCircle.setRadius(pos.accuracy); }
    els.currentLocationName.textContent = pos.accuracy <= GOOD_ACCURACY ? 'GPS chất lượng tốt' : 'GPS đang ổn định';
    els.currentLocationDetail.textContent = `Sai số khoảng ±${Math.round(pos.accuracy)} m${pos.altitude != null ? ` · cao độ ${Math.round(pos.altitude)} m` : ''}`;
    els.currentCoordinates.textContent = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
    els.gpsStatus.textContent = 'Đang theo dõi GPS';
    els.gpsAccuracy.textContent = `Sai số ±${Math.round(pos.accuracy)} m`;
    els.gpsDot.classList.add('active');
    if (followMode || navigationActive) map.panTo([pos.lat,pos.lng], {animate:true,duration:.35});
  }

  function onPosition(position) {
    const c = position.coords;
    const sample = {lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,altitude:c.altitude,altitudeAccuracy:c.altitudeAccuracy,heading:c.heading,speed:c.speed,time:Date.now()};
    if (sample.accuracy > REJECT_ACCURACY && currentPosition) {
      els.gpsAccuracy.textContent = `Bỏ qua mẫu GPS sai số ±${Math.round(sample.accuracy)} m`;
      return;
    }
    recentSamples.push(sample); recentSamples = recentSamples.slice(-8);
    currentPosition = weightedPosition();
    updateGpsVisual(currentPosition);

    if ((navigationActive || (routeData && startMode==='gps')) && destination) {
      const now = Date.now();
      const moved = lastRoutePosition ? VM.haversine(lastRoutePosition,[currentPosition.lat,currentPosition.lng]) : Infinity;
      if (moved >= REROUTE_DISTANCE && now-lastRouteAt >= REROUTE_INTERVAL) calculateRoute({silent:true,fit:false});
      updateNavigationProgress();
    }
  }

  function startTracking() {
    if (!navigator.geolocation) return alert('Trình duyệt không hỗ trợ GPS.');
    if (watchId != null) return;
    els.gpsStatus.textContent = 'Đang lấy GPS…';
    watchId = navigator.geolocation.watchPosition(onPosition, err => {
      els.gpsStatus.textContent = 'Không lấy được GPS';
      els.gpsAccuracy.textContent = err.message || 'Hãy kiểm tra quyền vị trí.';
    }, {enableHighAccuracy:true, maximumAge:0, timeout:20000});
    tracking = true;
    els.toggleTracking.querySelector('span:last-child').textContent = 'Dừng theo dõi GPS';
  }

  function stopTracking() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null; tracking = false;
    els.toggleTracking.querySelector('span:last-child').textContent = 'Bắt đầu theo dõi GPS';
    els.gpsDot.classList.remove('active');
  }

  function speak(text) {
    if (!voiceEnabled || !('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN'; u.rate = 1; u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function stepLocation(step) {
    const loc = step?.maneuver?.location;
    return Array.isArray(loc) ? [loc[1],loc[0]] : null;
  }

  function updateNavigationProgress() {
    if (!navigationActive || !currentPosition || !routeData || !activeSteps.length) return;
    const here = [currentPosition.lat,currentPosition.lng];
    let nearestIdx = activeStepIndex;
    let nearestDist = Infinity;
    for (let i=Math.max(0,activeStepIndex-1); i<activeSteps.length; i++) {
      const loc = stepLocation(activeSteps[i]); if (!loc) continue;
      const d = VM.haversine(here,loc);
      if (d < nearestDist) { nearestDist=d; nearestIdx=i; }
      if (d > nearestDist + 80 && i > activeStepIndex+3) break;
    }
    if (nearestIdx > activeStepIndex && nearestDist < 28) activeStepIndex = nearestIdx;
    const step = activeSteps[activeStepIndex];
    const loc = stepLocation(step);
    const dist = loc ? VM.haversine(here,loc) : step.distance;
    els.navTurnIcon.textContent = turnIcon(step);
    els.navDistanceToTurn.textContent = formatDistance(dist);
    els.navInstruction.textContent = turnInstruction(step);
    els.navStreet.textContent = step.name || 'Đường nội bộ TDTU';
    els.routeRemaining.textContent = destination ? formatDistance(VM.haversine(here,[destination.routeLat ?? destination.lat,destination.routeLng ?? destination.lng])) : '—';
    document.querySelectorAll('.route-step').forEach((el,i)=>el.classList.toggle('active', i===activeStepIndex));
    if (activeStepIndex !== lastSpokenIndex && (dist < 45 || activeStepIndex===0)) {
      speak(`${dist < 15 ? '' : `Sau ${Math.round(dist)} mét, `}${turnInstruction(step)}`);
      lastSpokenIndex = activeStepIndex;
    }
    if (destination && VM.haversine(here,[destination.routeLat ?? destination.lat,destination.routeLng ?? destination.lng]) < 12) {
      speak('Bạn đã đến điểm đích.');
      endNavigation();
    }
  }

  function beginNavigation() {
    if (startMode !== 'gps') return alert('Dẫn đường trực tiếp cần sử dụng GPS của bạn làm điểm bắt đầu.');
    if (!currentPosition) { startTracking(); return alert('Đang bật GPS. Hãy chờ có vị trí rồi bấm Bắt đầu lại.'); }
    if (!routeData) return alert('Hãy tạo tuyến trước.');
    navigationActive = true; followMode = true; activeStepIndex=0; lastSpokenIndex=-1;
    els.navigationBanner.hidden = false;
    els.beginNavigation.textContent = 'Đang dẫn đường…';
    els.beginNavigation.disabled = true;
    map.setZoom(Math.max(map.getZoom(),19));
    map.panTo([currentPosition.lat,currentPosition.lng]);
    speak('Bắt đầu dẫn đường.');
    updateNavigationProgress();
  }

  function endNavigation() {
    navigationActive = false;
    els.navigationBanner.hidden = true;
    els.beginNavigation.disabled = false;
    els.beginNavigation.textContent = '▶ Bắt đầu dẫn đường';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (routePolyline) map.fitBounds(routePolyline.getBounds(), {padding:[60,60]});
  }

  function resetAll() {
    endNavigation();
    routeLayer.clearLayers(); pointLayer.clearLayers();
    startMarker = destinationMarker = routePolyline = null;
    routeData = null; manualStart = null; destination = null;
    els.startSearchInput.value = ''; els.destinationInput.value='';
    els.manualStartName.textContent='Chưa chọn'; els.manualStartCoords.textContent='—';
    els.destinationName.textContent='Chưa chọn'; els.destinationCoords.textContent='—';
    els.routeTitle.textContent='Chưa có lộ trình'; els.routeDistance.textContent='—'; els.routeTime.textContent='—'; els.routeRemaining.textContent='—';
    els.emptyRoute.hidden=false; els.navigationActions.hidden=true; els.routeSteps.hidden=true; els.routeSteps.innerHTML='';
    setBadge('Sẵn sàng'); setPicking(null); map.fitBounds(VM.CORE_BOUNDS || VM.CAMPUS_BOUNDS, {padding:[30,30]});
  }

  // Map data / vector overlay.
  VM.drawCampusVectors(map).then(info => {
    els.vectorStatus.textContent = info.count ? `Đã tải ${info.count} đối tượng đường/công trình thực tế` : 'Đang dùng nền bản đồ địa lý thực tế';
  });
  map.fitBounds(VM.CORE_BOUNDS || VM.CAMPUS_BOUNDS, {padding:[30,30]});
  els.zoomValue.textContent = map.getZoom();
  map.on('zoomend', ()=>els.zoomValue.textContent=map.getZoom());

  map.on('click', e => {
    if (!picking) return;
    assignPoint(picking,e.latlng.lat,e.latlng.lng);
  });

  els.startModeSwitch.addEventListener('click', e => {
    const b=e.target.closest('[data-mode]'); if(!b)return;
    startMode=b.dataset.mode;
    els.startModeSwitch.querySelectorAll('.start-mode-btn').forEach(x=>x.classList.toggle('active',x===b));
    els.gpsModePanel.hidden=startMode!=='gps'; els.manualModePanel.hidden=startMode!=='manual';
    setPicking(null);
  });
  els.toggleTracking.addEventListener('click', ()=>tracking?stopTracking():startTracking());
  els.pickManualStart.addEventListener('click', ()=>setPicking('start'));
  els.pickDestination.addEventListener('click', ()=>setPicking('destination'));
  els.startSearch.addEventListener('click', ()=>performSearch('start'));
  els.destinationSearch.addEventListener('click', ()=>performSearch('destination'));
  els.startSearchInput.addEventListener('keydown',e=>{if(e.key==='Enter')performSearch('start');});
  els.destinationInput.addEventListener('keydown',e=>{if(e.key==='Enter')performSearch('destination');});
  els.startSearchInput.addEventListener('focus',()=>performSearch('start'));
  els.destinationInput.addEventListener('focus',()=>performSearch('destination'));
  bindSuggestionBox('start',els.startSuggestions); bindSuggestionBox('destination',els.destinationSuggestions);
  document.addEventListener('click',e=>{if(!e.target.closest('.start-search-wrap'))els.startSuggestions.classList.remove('show');if(!e.target.closest('.destination-search-wrap'))els.destinationSuggestions.classList.remove('show');});
  els.startRoute.addEventListener('click',()=>calculateRoute());
  els.beginNavigation.addEventListener('click',beginNavigation);
  els.endNavigation.addEventListener('click',endNavigation);
  els.voiceToggle.addEventListener('click',()=>{voiceEnabled=!voiceEnabled;els.voiceToggle.classList.toggle('active',voiceEnabled);els.voiceToggle.textContent=voiceEnabled?'🔊':'🔇';if(!voiceEnabled&&'speechSynthesis'in window)window.speechSynthesis.cancel();});
  els.followMe.addEventListener('click',()=>{followMode=!followMode;els.followMe.classList.toggle('active',followMode);if(followMode&&currentPosition)map.panTo([currentPosition.lat,currentPosition.lng]);});
  els.zoomIn.addEventListener('click',()=>map.zoomIn()); els.zoomOut.addEventListener('click',()=>map.zoomOut());
  els.resetRoute.addEventListener('click',resetAll);

  const params = new URLSearchParams(location.search);
  const lat = Number(params.get('lat')), lng = Number(params.get('lng'));
  if (Number.isFinite(lat)&&Number.isFinite(lng)) assignPoint('destination',lat,lng,params.get('name')||null);
  if (params.get('mode')==='mylocation') startTracking();

  VM.drawNativeMapLabels(map).catch?.(()=>{});
});
