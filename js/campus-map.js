document.addEventListener('DOMContentLoaded', () => {
    const CAMPUS_CENTER = [10.73182, 106.69943];
    const CAMPUS_BOUNDS = L.latLngBounds([10.73055, 106.69845], [10.73320, 106.70035]);
    const map = L.map('campusLeafletMap', {
        minZoom: 16,
        maxZoom: 20,
        maxBounds: CAMPUS_BOUNDS.pad(0.45)
    }).setView(CAMPUS_CENTER, 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const els = {
        search: document.getElementById('campusSearch'),
        results: document.getElementById('campusSearchResults'),
        fit: document.getElementById('fitCampus'),
        name: document.getElementById('selectedPlaceName'),
        detail: document.getElementById('selectedPlaceDetail'),
        coords: document.getElementById('selectedPlaceCoords'),
        route: document.getElementById('selectedPlaceRoute')
    };

    let marker = null;
    let selected = null;
    let searchAbortController = null;

    function icon() {
        return L.divIcon({
            className: '',
            html: '<div class="destination-map-pin"><span></span></div>',
            iconSize: [34, 44],
            iconAnchor: [17, 42]
        });
    }

    function updateSelection(lat, lng, name = 'Điểm đã chọn trên bản đồ', detail = 'Tọa độ lấy trực tiếp từ bản đồ OpenStreetMap') {
        selected = { lat, lng, name, detail };
        if (!marker) marker = L.marker([lat, lng], { icon: icon() }).addTo(map);
        else marker.setLatLng([lat, lng]);
        els.name.textContent = name;
        els.detail.textContent = detail;
        els.coords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        els.route.href = `navigation.html?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&name=${encodeURIComponent(name)}`;
        els.route.classList.remove('disabled-link');
    }

    async function reverseName(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) return;
            const data = await response.json();
            const name = data.name || (data.display_name || '').split(',')[0] || 'Điểm đã chọn trên bản đồ';
            if (selected && Math.abs(selected.lat - lat) < 1e-7 && Math.abs(selected.lng - lng) < 1e-7) {
                updateSelection(lat, lng, name, data.display_name || 'Địa điểm từ OpenStreetMap');
            }
        } catch { /* vẫn giữ tọa độ click nếu reverse geocoding lỗi */ }
    }

    async function searchOSM() {
        const query = els.search.value.trim();
        if (!query) {
            els.results.innerHTML = '';
            return;
        }
        if (searchAbortController) searchAbortController.abort();
        searchAbortController = new AbortController();
        els.results.innerHTML = '<div class="osm-result-note">Đang tìm trên OpenStreetMap…</div>';
        const left = 106.69845, right = 106.70035, top = 10.73320, bottom = 10.73055;
        const q = `${query}, Trường Đại học Tôn Đức Thắng, Hồ Chí Minh`;
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&bounded=1&viewbox=${left},${top},${right},${bottom}&q=${encodeURIComponent(q)}`;
        try {
            const response = await fetch(url, { signal: searchAbortController.signal, headers: { 'Accept': 'application/json' } });
            if (!response.ok) throw new Error('search');
            const data = await response.json();
            if (!data.length) {
                els.results.innerHTML = '<div class="osm-result-note">Không tìm thấy. Hãy bấm trực tiếp lên bản đồ.</div>';
                return;
            }
            els.results.innerHTML = data.map((item, index) => {
                const title = item.name || (item.display_name || '').split(',')[0];
                return `<button type="button" class="osm-result-item" data-index="${index}"><strong>${title}</strong><span>${item.display_name}</span></button>`;
            }).join('');
            els.results.dataset.items = JSON.stringify(data.map(item => ({
                lat: Number(item.lat), lng: Number(item.lon), name: item.name || (item.display_name || '').split(',')[0], detail: item.display_name
            })));
        } catch (error) {
            if (error.name !== 'AbortError') els.results.innerHTML = '<div class="osm-result-note">Không thể tìm kiếm lúc này. Hãy bấm trực tiếp lên bản đồ.</div>';
        }
    }

    map.on('click', event => {
        const { lat, lng } = event.latlng;
        updateSelection(lat, lng);
        reverseName(lat, lng);
    });

    els.search.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchOSM();
    });
    els.search.addEventListener('input', () => {
        if (!els.search.value.trim()) els.results.innerHTML = '';
    });
    els.results.addEventListener('click', event => {
        const itemEl = event.target.closest('[data-index]');
        if (!itemEl) return;
        const items = JSON.parse(els.results.dataset.items || '[]');
        const item = items[Number(itemEl.dataset.index)];
        if (!item) return;
        updateSelection(item.lat, item.lng, item.name, item.detail);
        map.flyTo([item.lat, item.lng], 19, { duration: 0.7 });
        els.results.innerHTML = '';
    });
    els.fit.addEventListener('click', () => map.fitBounds(CAMPUS_BOUNDS, { padding: [20, 20] }));

    map.fitBounds(CAMPUS_BOUNDS, { padding: [20, 20] });
});
