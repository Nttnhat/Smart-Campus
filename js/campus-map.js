document.addEventListener('DOMContentLoaded', () => {
  const VM = window.TDTUVectorMap;
  const map = VM.createBaseMap('realCampusMap');
  const pointLayer = L.layerGroup().addTo(map);
  const gpsLayer = L.layerGroup().addTo(map);
  const search = document.getElementById('campusSearch');
  const results = document.getElementById('campusSearchResults');
  const selectedName = document.getElementById('selectedPlaceName');
  const selectedDetail = document.getElementById('selectedPlaceDetail');
  const selectedCoords = document.getElementById('selectedCoordinates');
  const routeLink = document.getElementById('selectedPlaceRoute');
  const dataStatus = document.getElementById('mapDataStatus');
  const gpsStatus = document.getElementById('gpsMapStatus');
  const gpsDetail = document.getElementById('gpsMapDetail');
  const toggleGps = document.getElementById('toggleMapGps');
  const zoomReadout = document.getElementById('zoomCampus');
  let selectedMarker = null;
  let gpsMarker = null;
  let accuracyCircle = null;
  let watchId = null;
  let searchAbort = null;

  VM.drawCampusVectors(map).then(info => {
    dataStatus.textContent = info.count ? `Đã tải ${info.count} đối tượng thực tế` : 'Đang dùng nền bản đồ địa lý';
  });
  map.fitBounds(VM.CORE_BOUNDS || VM.CAMPUS_BOUNDS, {padding:[30,30]});
  zoomReadout.textContent = map.getZoom();
  map.on('zoomend',()=>zoomReadout.textContent=map.getZoom());

  function markerIcon(label, color='#D31145') {
    return L.divIcon({className:'',html:`<div style="background:${color};color:#fff;border:3px solid #fff;border-radius:999px;padding:7px 10px;font-weight:800;box-shadow:0 5px 18px rgba(15,23,42,.25);white-space:nowrap">${VM.escapeHtml(label)}</div>`,iconAnchor:[20,18]});
  }

  async function reverseName(lat,lng) {
    try {
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&namedetails=1&addressdetails=1`,{headers:{'Accept-Language':'vi'}});
      const d=await r.json(); const a=d.address||{};
      return {name:d.namedetails?.name||d.name||a.building||a.amenity||a.road||'Điểm đã chọn', detail:d.display_name||''};
    } catch (_) { return {name:'Điểm đã chọn',detail:''}; }
  }

  async function selectPoint(lat,lng,name=null,detail=null) {
    if (!name) { const r=await reverseName(lat,lng); name=r.name; detail=r.detail; }
    pointLayer.clearLayers();
    selectedMarker=L.marker([lat,lng],{icon:markerIcon('Điểm chọn')}).addTo(pointLayer);
    selectedName.textContent=name; selectedDetail.textContent=detail||'Vị trí trong khuôn viên';
    selectedCoords.textContent=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    routeLink.classList.remove('disabled-link');
    routeLink.href=`navigation.html?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&name=${encodeURIComponent(name)}`;
    map.flyTo([lat,lng],19,{duration:.6});
  }

  map.on('click',e=>selectPoint(e.latlng.lat,e.latlng.lng));

  async function doSearch() {
    const q=search.value.trim();
    if(searchAbort)searchAbort.abort(); searchAbort=new AbortController();
    results.innerHTML='<div class="official-search-empty">Đang tìm…</div>';
    const list=await VM.searchCampus(q,searchAbort.signal).catch(()=>[]);
    if(!list.length){results.innerHTML='<div class="official-search-empty">Không tìm thấy. Hãy chọn trực tiếp trên bản đồ.</div>';return;}
    results.innerHTML=list.map((r,i)=>`<button type="button" data-i="${i}" class="official-search-item"><strong>${VM.escapeHtml(r.name)}</strong><span>${VM.escapeHtml(r.detail)}</span></button>`).join('');
    results.dataset.items=JSON.stringify(list);
  }
  search.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  search.addEventListener('focus',doSearch);
  search.addEventListener('input',()=>{clearTimeout(search._t);search._t=setTimeout(doSearch,450);});
  results.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;const list=JSON.parse(results.dataset.items||'[]');const r=list[Number(b.dataset.i)];if(r)selectPoint(r.lat,r.lng,r.name,r.detail);});

  toggleGps.addEventListener('click',()=>{
    if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null;toggleGps.textContent='Bật GPS';gpsStatus.textContent='Đã dừng GPS';return;}
    if(!navigator.geolocation)return alert('Trình duyệt không hỗ trợ GPS.');
    toggleGps.textContent='Dừng GPS'; gpsStatus.textContent='Đang lấy GPS…';
    watchId=navigator.geolocation.watchPosition(pos=>{
      const c=pos.coords; const ll=[c.latitude,c.longitude];
      if(!gpsMarker)gpsMarker=L.marker(ll,{icon:markerIcon('Bạn','#0ea5e9')}).addTo(gpsLayer);else gpsMarker.setLatLng(ll);
      if(!accuracyCircle)accuracyCircle=L.circle(ll,{radius:c.accuracy,color:'#0ea5e9',weight:1,fillColor:'#0ea5e9',fillOpacity:.08}).addTo(gpsLayer);else{accuracyCircle.setLatLng(ll);accuracyCircle.setRadius(c.accuracy);}
      gpsStatus.textContent='GPS đang hoạt động'; gpsDetail.textContent=`Sai số khoảng ±${Math.round(c.accuracy)} m`; map.panTo(ll);
    },err=>{gpsStatus.textContent='Không lấy được GPS';gpsDetail.textContent=err.message;},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  });

  document.getElementById('zoomInCampus').addEventListener('click',()=>map.zoomIn());
  document.getElementById('zoomOutCampus').addEventListener('click',()=>map.zoomOut());
  document.getElementById('fitCampus').addEventListener('click',()=>map.fitBounds(VM.CAMPUS_BOUNDS,{padding:[30,30]}));

  VM.drawNativeMapLabels(map).catch?.(()=>{});
});
