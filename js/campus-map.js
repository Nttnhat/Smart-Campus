document.addEventListener('DOMContentLoaded', async () => {
  const VM = window.TDTUVectorMap;
  const placesReady = VM.loadOfficialPlaces();
  const map = VM.createBaseMap('realCampusMap');
  const pointLayer = L.layerGroup().addTo(map);
  const gpsLayer = L.layerGroup().addTo(map);
  const search = document.getElementById('campusSearch');
  const results = document.getElementById('campusSearchResults');
  const selectedName = document.getElementById('selectedPlaceName');
  const selectedDetail = document.getElementById('selectedPlaceDetail');
  const selectedCoords = document.getElementById('selectedCoordinates');
  const routeLink = document.getElementById('selectedPlaceRoute');
  const detailsLink = document.getElementById('selectedPlaceDetails');
  const gpsStatus = document.getElementById('gpsMapStatus');
  const gpsDetail = document.getElementById('gpsMapDetail');
  const toggleGps = document.getElementById('toggleMapGps');
  const zoomReadout = document.getElementById('zoomCampus');
  let selectedMarker = null;
  let gpsMarker = null;
  let accuracyCircle = null;
  let watchId = null;
  let searchAbort = null;

  VM.addRealBasemap(map);
  map.fitBounds(VM.CORE_BOUNDS || VM.CAMPUS_BOUNDS, {padding:[30,30]});
  zoomReadout.textContent = map.getZoom();
  map.on('zoomend',()=>zoomReadout.textContent=map.getZoom());

  function markerIcon(label, color='#D31145') {
    return L.divIcon({className:'',html:`<div style="background:${color};color:#fff;border:3px solid #fff;border-radius:999px;padding:7px 10px;font-weight:800;box-shadow:0 5px 18px rgba(15,23,42,.25);white-space:nowrap">${VM.escapeHtml(label)}</div>`,iconAnchor:[20,18]});
  }

  async function reverseName(lat,lng) {
    try {
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&namedetails=1&addressdetails=1`,{headers:{'Accept-Language':'vi'},signal:AbortSignal.timeout(4000)});
      const d=await r.json(); const a=d.address||{};
      return {name:d.namedetails?.name||d.name||a.building||a.amenity||a.road||'Điểm đã chọn', detail:d.display_name||''};
    } catch (_) { return {name:'Điểm đã chọn',detail:''}; }
  }

  let selectToken = 0;

  // ---- Yêu thích (chỉ khi đã đăng nhập sinh viên; khách bấm thì được mời đăng nhập) ----
  const favBtn = document.getElementById('favoriteToggle');
  const loggedIn = favBtn && favBtn.dataset.loggedIn === '1';
  let favoriteIds = new Set();
  let selectedId = null;
  if (loggedIn) {
    window.SCApi.apiFetch('api/user/favorites.php')
      .then(d => { favoriteIds = new Set(d.results.map(f => f.id)); renderFavorite(); })
      .catch(() => {});
  }
  function renderFavorite() {
    if (!favBtn) return;
    favBtn.disabled = !selectedId;
    const on = favoriteIds.has(selectedId);
    favBtn.setAttribute('aria-pressed', String(on));
    favBtn.textContent = on ? '★ Đã lưu yêu thích' : '☆ Lưu vào yêu thích';
  }
  if (favBtn) favBtn.addEventListener('click', async () => {
    if (!selectedId) return;
    if (!loggedIn) {
      if (confirm('Đăng nhập tài khoản sinh viên để lưu địa điểm yêu thích?')) location.href = 'login.php?next=campus-map.php';
      return;
    }
    const adding = !favoriteIds.has(selectedId);
    favBtn.disabled = true;
    try {
      await window.SCApi.apiFetch('api/user/favorites.php', {method:'POST', data:{slug:selectedId, action: adding ? 'add' : 'remove'}});
      adding ? favoriteIds.add(selectedId) : favoriteIds.delete(selectedId);
    } catch (err) { alert(err.message); }
    renderFavorite();
  });

  function showSelection(lat,lng,name,detail,id=null) {
    selectedName.textContent=name; selectedDetail.textContent=detail||'Vị trí trong khuôn viên';
    selectedId = id;
    renderFavorite();
    routeLink.href = id
      ? `navigation.php?slug=${encodeURIComponent(id)}`
      : `navigation.php?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&name=${encodeURIComponent(name)}`;
    // Chỉ bật nút "Xem thông tin chi tiết" khi điểm khớp một địa điểm có sẵn (có id/slug) - điểm
    // bấm tự do trên bản đồ (reverse-geocode) không có trang chi tiết tương ứng.
    if (id) {
      detailsLink.href = `building-details.php?slug=${encodeURIComponent(id)}`;
      detailsLink.classList.remove('disabled-link');
    } else {
      detailsLink.href = 'building-details.php';
      detailsLink.classList.add('disabled-link');
    }
  }

  async function selectPoint(lat,lng,name=null,detail=null,id=null) {
    const token = ++selectToken;
    const hit = name ? null : window.ResolvePlace.resolvePlaceAtPoint(lat, lng, VM.OFFICIAL_PLACES, 12, [...VM.buildingAreas, ...VM.greenAreas]);
    pointLayer.clearLayers();
    selectedMarker=L.marker([lat,lng],{icon:markerIcon('Điểm chọn')}).addTo(pointLayer);
    selectedCoords.textContent=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    routeLink.classList.remove('disabled-link');
    map.flyTo([lat,lng],19,{duration:.4});
    if (name || hit) {
      showSelection(lat,lng,name||hit.name,detail||hit?.category,id||hit?.id);
      return;
    }
    showSelection(lat,lng,'Đang xác định…',null);
    const r = await reverseName(lat,lng);
    if (token !== selectToken) return;
    showSelection(lat,lng,r.name,r.detail);
  }

  map.on('click',e=>selectPoint(e.latlng.lat,e.latlng.lng));

  // Tìm địa điểm qua api/search.php (tìm trong database: tên không dấu + bí danh, xếp theo độ liên quan).
  // API lỗi (vd mở không có PHP) -> rơi về tìm trên danh sách đã tải sẵn.
  async function searchPlaces(q,signal){
    try{
      const d=await window.SCApi.apiFetch(`api/search.php?q=${encodeURIComponent(q)}&limit=${q?20:50}`,{signal});
      return (d.results||[]).map(p=>({
        id:p.slug, name:p.name, lat:Number(p.lat), lng:Number(p.lng),
        detail:`${p.category_name||'Địa điểm'} · Trường Đại học Tôn Đức Thắng`
      }));
    }catch(error){
      if(signal.aborted) throw error;
      console.warn('api/search.php lỗi, dùng tìm kiếm cục bộ:',error);
      return VM.searchCampus(q,signal);
    }
  }

  async function doSearch() {
    const q=search.value.trim();
    if(searchAbort)searchAbort.abort(); searchAbort=new AbortController();
    results.innerHTML='<div class="official-search-empty">Đang tìm…</div>';
    results.classList.add('show'); // CSS mặc định ẩn khung kết quả, chỉ hiện khi có class "show".
    const signal=searchAbort.signal;
    const [list, rooms]=await Promise.all([
      searchPlaces(q,signal).catch(()=>[]),
      // Tìm phòng (vd "A304", "phòng tài chính") -> mở trang tòa nhà đúng tầng, đánh dấu phòng.
      q.length>=2 ? window.SCApi.apiFetch(`api/rooms.php?q=${encodeURIComponent(q)}`,{signal}).then(d=>d.results).catch(()=>[]) : []
    ]);
    if(signal.aborted) return;
    if(!list.length && !rooms.length){
      results.innerHTML='<div class="official-search-empty">Không tìm thấy. Hãy chọn trực tiếp trên bản đồ.</div>';
      if(q) window.SCApi.logEvent('search',{keyword:q,result_count:0});
      return;
    }
    const roomHtml=rooms.map(r=>`<a class="official-search-item" href="building-details.php?slug=${encodeURIComponent(r.building.slug)}&room=${encodeURIComponent(r.code)}"><strong>Phòng ${VM.escapeHtml(r.code)}${r.name?` · ${VM.escapeHtml(r.name)}`:''}</strong><span>${VM.escapeHtml(r.building.name)} · ${VM.escapeHtml(r.floor.name)}</span></a>`).join('');
    results.innerHTML=roomHtml+list.map((r,i)=>`<button type="button" data-i="${i}" class="official-search-item"><strong>${VM.escapeHtml(r.name)}</strong><span>${VM.escapeHtml(r.detail)}</span></button>`).join('');
    results.dataset.items=JSON.stringify(list);
  }
  const hideResults=()=>{ if(searchAbort)searchAbort.abort(); results.classList.remove('show'); };
  search.addEventListener('keydown',e=>{
    if(e.key==='Enter'){clearTimeout(search._t);doSearch();}
    else if(e.key==='Escape'){clearTimeout(search._t);hideResults();}
  });
  search.addEventListener('focus',doSearch);
  search.addEventListener('input',()=>{clearTimeout(search._t);search._t=setTimeout(doSearch,450);});
  // Bấm ra ngoài ô tìm kiếm / khung kết quả -> đóng khung kết quả.
  document.addEventListener('click',e=>{
    if(!e.target.closest('#campusSearch, #campusSearchResults')) hideResults();
  });
  results.addEventListener('click',e=>{
    const b=e.target.closest('[data-i]'); if(!b) return;
    const list=JSON.parse(results.dataset.items||'[]'); const r=list[Number(b.dataset.i)];
    if(!r) return;
    hideResults();
    selectPoint(r.lat,r.lng,r.name,r.detail,r.id);
    window.SCApi.logEvent('search', {keyword: search.value.trim() || r.name, selected_slug: r.id || '', result_count: list.length});
  });

  // GPS qua bộ lọc (js/lib/gps-filter.js): bỏ mẫu sai lớn lúc khởi động, bỏ bước nhảy, làm mượt.
  const gpsFilter = window.GpsFilter.createGpsFilter();
  toggleGps.addEventListener('click',()=>{
    if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null;toggleGps.textContent='Bật GPS';gpsStatus.textContent='Đã dừng GPS';return;}
    if(!navigator.geolocation)return alert('Trình duyệt không hỗ trợ GPS.');
    if(!window.isSecureContext){gpsStatus.textContent='GPS cần HTTPS';gpsDetail.textContent='Trình duyệt chỉ cho dùng vị trí trên https:// hoặc localhost.';return;}
    gpsFilter.reset();
    toggleGps.textContent='Dừng GPS'; gpsStatus.textContent='Đang lấy GPS…';
    watchId=navigator.geolocation.watchPosition(pos=>{
      const c=pos.coords;
      const r=gpsFilter.update({lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,time:Date.now()});
      if(r.status==='warming'){gpsStatus.textContent='Đang dò tín hiệu GPS…';gpsDetail.textContent=`Mẫu hiện tại ±${Math.round(c.accuracy)} m`;return;}
      if(!r.position||r.rejected)return;
      const ll=[r.position.lat,r.position.lng], acc=r.position.accuracy;
      if(!gpsMarker)gpsMarker=L.marker(ll,{icon:markerIcon('Bạn','#0ea5e9')}).addTo(gpsLayer);else gpsMarker.setLatLng(ll);
      if(!accuracyCircle)accuracyCircle=L.circle(ll,{radius:acc,color:'#0ea5e9',weight:1,fillColor:'#0ea5e9',fillOpacity:.08}).addTo(gpsLayer);else{accuracyCircle.setLatLng(ll);accuracyCircle.setRadius(acc);}
      gpsStatus.textContent = r.status==='low-accuracy' ? 'GPS kém chính xác' : 'GPS đang hoạt động';
      gpsDetail.textContent = r.noGpsHardware
        ? `Thiết bị có vẻ không có GPS (±${Math.round(c.accuracy)} m) - nên mở trên điện thoại.`
        : `Sai số khoảng ±${Math.round(acc)} m`;
      map.panTo(ll);
    },err=>{gpsStatus.textContent='Không lấy được GPS';gpsDetail.textContent=err.message;},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  });

  // Chia sẻ vị trí (UC-12): poll phiên đang active, vẽ marker bạn + gửi vị trí của mình lên nếu đang bật GPS.
  if (loggedIn) {
    const friendMarkers = new Map(); // shareId -> L.Marker
    async function pollShares() {
      let data;
      try { data = await window.SCApi.apiFetch('api/user/location-share.php'); } catch (_) { return; }
      const activeIds = new Set();
      for (const s of data.results) {
        if (s.status !== 'active') continue;
        activeIds.add(s.id);
        if (gpsMarker) {
          const ll = gpsMarker.getLatLng();
          window.SCApi.apiFetch('api/user/location-share.php', { method: 'POST', data: { action: 'update', id: s.id, lat: ll.lat, lng: ll.lng } }).catch(() => {});
        }
        if (!s.otherPosition) continue;
        const ll = [s.otherPosition.lat, s.otherPosition.lng];
        let m = friendMarkers.get(s.id);
        if (!m) { m = L.marker(ll, { icon: markerIcon(s.otherName, '#16a34a') }).addTo(gpsLayer); friendMarkers.set(s.id, m); }
        else m.setLatLng(ll);
      }
      for (const [id, m] of friendMarkers) {
        if (!activeIds.has(id)) { map.removeLayer(m); friendMarkers.delete(id); }
      }
    }
    pollShares();
    setInterval(pollShares, 5000);
  }

  document.getElementById('zoomInCampus').addEventListener('click',()=>map.zoomIn());
  document.getElementById('zoomOutCampus').addEventListener('click',()=>map.zoomOut());
  document.getElementById('fitCampus').addEventListener('click',()=>map.fitBounds(VM.CAMPUS_BOUNDS,{padding:[30,30]}));

  // Ẩn/hiện menu bên trái: dùng chung key với navigation.js để trạng thái đồng bộ giữa 2 trang.
  (function setupSidebarToggle() {
    const KEY = 'tdtu_sidebar_hidden';
    const page = document.getElementById('campusMapPage');
    const toggleBtn = document.getElementById('sidebarToggle');
    if (!page || !toggleBtn) return;
    const applyInvalidate = () => setTimeout(() => map.invalidateSize(), 260);
    let hidden = false;
    try { hidden = localStorage.getItem(KEY) === '1'; } catch (_) { hidden = false; }
    page.classList.toggle('sidebar-collapsed', hidden);
    toggleBtn.addEventListener('click', () => {
      hidden = !hidden;
      page.classList.toggle('sidebar-collapsed', hidden);
      try { localStorage.setItem(KEY, hidden ? '1' : '0'); } catch (_) { /* bỏ qua */ }
      applyInvalidate();
    });
  })();

  // Xoay ngang/dọc hoặc đổi kích thước cửa sổ (vd bàn phím ảo ẩn/hiện): Leaflet không tự biết
  // container đổi kích thước, phải gọi lại invalidateSize() để bản đồ vẽ đúng, không bị xám/lệch.
  let resizeTimer = null;
  const onViewportResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => map.invalidateSize(), 200);
  };
  window.addEventListener('resize', onViewportResize);
  window.addEventListener('orientationchange', onViewportResize);

  await placesReady;
  VM.drawOfficialLabels(map);

  // ?focus=toa-a (từ trang chi tiết "Xem trên bản đồ") -> chọn sẵn địa điểm đó.
  const focusId = new URLSearchParams(location.search).get('focus');
  const focusPlace = focusId && VM.OFFICIAL_PLACES.find(p => p.id === focusId);
  if (focusPlace) selectPoint(focusPlace.lat, focusPlace.lng, focusPlace.name, focusPlace.category, focusPlace.id);
});
