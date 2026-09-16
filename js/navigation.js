document.addEventListener('DOMContentLoaded', () => {
    const CAMPUS_CENTER = [10.73182, 106.69943];
    const CAMPUS_BOUNDS = L.latLngBounds(
        [10.73055, 106.69845],
        [10.73320, 106.70035]
    );
    const ROUTING_BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
    const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
    const MIN_GOOD_ACCURACY = 50;
    const REROUTE_DISTANCE = 10;
    const REROUTE_INTERVAL = 7000;

    const map = L.map('leafletMap', {
        zoomControl: false,
        minZoom: 16,
        maxZoom: 20,
        maxBounds: CAMPUS_BOUNDS.pad(0.45)
    }).setView(CAMPUS_CENTER, 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const els = {
        toggleTracking: document.getElementById('toggleTracking'),
        gpsDot: document.getElementById('gpsDot'),
        gpsStatus: document.getElementById('gpsStatus'),
        gpsAccuracy: document.getElementById('gpsAccuracy'),
        startModeSwitch: document.getElementById('startModeSwitch'),
        gpsModePanel: document.getElementById('gpsModePanel'),
        manualModePanel: document.getElementById('manualModePanel'),
        pickManualStart: document.getElementById('pickManualStart'),
        startSearchInput: document.getElementById('startSearchInput'),
        searchStart: document.getElementById('searchStart'),
        startSuggestions: document.getElementById('startSearchSuggestions'),
        manualStartName: document.getElementById('manualStartName'),
        manualStartCoords: document.getElementById('manualStartCoords'),
        destinationInput: document.getElementById('destinationInput'),
        searchDestination: document.getElementById('searchDestination'),
        suggestions: document.getElementById('searchSuggestions'),
        destinationName: document.getElementById('destinationName'),
        destinationCoords: document.getElementById('destinationCoords'),
        startRoute: document.getElementById('startRoute'),
        routeTitle: document.getElementById('routeTitle'),
        routeDistance: document.getElementById('routeDistance'),
        routeTime: document.getElementById('routeTime'),
        routeRemaining: document.getElementById('routeRemaining'),
        routeStateBadge: document.getElementById('routeStateBadge'),
        emptyRoute: document.getElementById('emptyRoute'),
        routeSteps: document.getElementById('routeSteps'),
        currentLocationName: document.getElementById('currentLocationName'),
        currentLocationDetail: document.getElementById('currentLocationDetail'),
        currentCoordinates: document.getElementById('currentCoordinates'),
        currentLocationCard: document.getElementById('currentLocationCard'),
        followMe: document.getElementById('followMe'),
        zoomIn: document.getElementById('zoomIn'),
        zoomOut: document.getElementById('zoomOut'),
        zoomValue: document.getElementById('zoomValue'),
        resetRoute: document.getElementById('resetRoute'),
        mapClickHint: document.getElementById('mapClickHint'),
        navigationActions: document.getElementById('navigationActions'),
        beginNavigation: document.getElementById('beginNavigation'),
        voiceToggle: document.getElementById('voiceToggle'),
        navigationBanner: document.getElementById('navigationBanner'),
        navTurnIcon: document.getElementById('navTurnIcon'),
        navDistanceToTurn: document.getElementById('navDistanceToTurn'),
        navInstruction: document.getElementById('navInstruction'),
        navStreet: document.getElementById('navStreet'),
        endNavigation: document.getElementById('endNavigation')
    };

    let watchId = null;
    let tracking = false;
    let followMode = true;
    let userMarker = null;
    let accuracyCircle = null;
    let snappedStartMarker = null;
    let destinationMarker = null;
    let routeLayer = null;
    let destination = null;
    let currentPosition = null;
    let latestRawPosition = null;
    let recentSamples = [];
    let lastRoutePosition = null;
    let lastRouteAt = 0;
    let routingBusy = false;
    let destinationSearchAbortController = null;
    let startSearchAbortController = null;
    let startMode = 'gps';
    let manualStart = null;
    let manualStartMarker = null;
    let pickingManualStart = false;
    let navigationActive = false;
    let voiceEnabled = true;
    let activeRouteSteps = [];
    let activeStepIndex = 0;
    let lastSpokenStepIndex = -1;
    let routeData = null;

    function toRad(v) { return v * Math.PI / 180; }

    function distanceMeters(a, b) {
        if (!a || !b) return Infinity;
        const R = 6371000;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const s1 = Math.sin(dLat / 2);
        const s2 = Math.sin(dLng / 2);
        const q = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
        return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
    }

    function formatDistance(meters) {
        if (!Number.isFinite(meters)) return '—';
        return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
    }

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds)) return '—';
        const minutes = Math.max(1, Math.round(seconds / 60));
        return `${minutes} phút`;
    }

    function destinationIcon() {
        return L.divIcon({
            className: '',
            html: '<div class="destination-map-pin"><span></span></div>',
            iconSize: [34, 44],
            iconAnchor: [17, 42]
        });
    }

    function userIcon(navigation = false, heading = null) {
        const safeHeading = Number.isFinite(heading) ? heading : 0;
        const cls = navigation ? 'live-user-marker navigation-active' : 'live-user-marker';
        const style = navigation ? ` style="transform:rotate(${safeHeading}deg)"` : '';
        return L.divIcon({
            className: '',
            html: `<div class="${cls}"><span${style}></span></div>`,
            iconSize: navigation ? [32, 38] : [28, 28],
            iconAnchor: navigation ? [16, 24] : [14, 14]
        });
    }

    function manualStartIcon() {
        return L.divIcon({
            className: '',
            html: '<div class="manual-start-map-pin"><span></span></div>',
            iconSize: [28, 36],
            iconAnchor: [14, 34]
        });
    }

    function snappedIcon() {
        return L.divIcon({
            className: '',
            html: '<div class="snapped-route-marker"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    }

    function setTrackingUI(active) {
        tracking = active;
        els.gpsDot.classList.toggle('active', active);
        els.toggleTracking.classList.toggle('tracking', active);
        els.toggleTracking.querySelector('span').textContent = active ? 'Dừng theo dõi GPS' : 'Bắt đầu theo dõi GPS';
        els.gpsStatus.textContent = active ? 'Đang theo dõi vị trí liên tục' : 'GPS chưa bật';
    }

    function smoothPosition(sample) {
        if (sample.accuracy > 100) return currentPosition || sample;
        recentSamples.push(sample);
        recentSamples = recentSamples.slice(-5);
        const usable = recentSamples.filter(s => s.accuracy <= 80);
        if (!usable.length) return sample;

        let weightSum = 0;
        let latSum = 0;
        let lngSum = 0;
        usable.forEach(s => {
            const weight = 1 / Math.max(4, s.accuracy) ** 2;
            weightSum += weight;
            latSum += s.lat * weight;
            lngSum += s.lng * weight;
        });

        return {
            ...sample,
            lat: latSum / weightSum,
            lng: lngSum / weightSum
        };
    }

    function updateUserOnMap(position) {
        const latlng = [position.lat, position.lng];
        if (!userMarker) {
            userMarker = L.marker(latlng, { icon: userIcon(navigationActive, position.heading), zIndexOffset: 1000 }).addTo(map).bindTooltip('Vị trí của bạn');
        } else {
            userMarker.setLatLng(latlng);
            userMarker.setIcon(userIcon(navigationActive, position.heading));
        }

        if (!accuracyCircle) {
            accuracyCircle = L.circle(latlng, {
                radius: position.accuracy,
                color: '#0ea5e9',
                weight: 1,
                opacity: 0.65,
                fillColor: '#38bdf8',
                fillOpacity: 0.12
            }).addTo(map);
        } else {
            accuracyCircle.setLatLng(latlng).setRadius(position.accuracy);
        }

        if (followMode) {
            if (navigationActive && map.getZoom() < 19) map.setZoom(19, { animate: true });
            map.panTo(latlng, { animate: true, duration: 0.4 });
        }

        const alt = Number.isFinite(position.altitude) ? ` · cao độ ${Math.round(position.altitude)} m` : '';
        els.currentLocationName.textContent = 'Vị trí GPS hiện tại';
        els.currentLocationDetail.textContent = `Sai số khoảng ±${Math.round(position.accuracy)} m${alt}`;
        els.currentCoordinates.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        els.gpsAccuracy.textContent = position.accuracy <= MIN_GOOD_ACCURACY
            ? `GPS tốt · sai số ±${Math.round(position.accuracy)} m`
            : `GPS yếu · sai số ±${Math.round(position.accuracy)} m, chờ tín hiệu tốt hơn để cập nhật tuyến.`;
        els.currentLocationCard.classList.toggle('low-accuracy', position.accuracy > MIN_GOOD_ACCURACY);
    }

    async function reverseName(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=19&addressdetails=1&namedetails=1`;
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json', 'Accept-Language': 'vi' }
            });
            if (!response.ok) return null;
            const data = await response.json();
            const a = data.address || {};
            const exactName = data.name || data.namedetails?.name || a.amenity || a.building || a.university || a.school || a.shop || a.office || a.leisure || a.road || (data.display_name || '').split(',')[0] || 'Điểm trên bản đồ';
            return { name: exactName, displayName: data.display_name || exactName };
        } catch {
            return null;
        }
    }

    async function setDestination(lat, lng, name = null, center = false) {
        destination = { lat, lng, name: name || 'Điểm đã chọn trên bản đồ' };
        if (!destinationMarker) {
            destinationMarker = L.marker([lat, lng], { icon: destinationIcon(), zIndexOffset: 900 }).addTo(map);
        } else {
            destinationMarker.setLatLng([lat, lng]);
        }

        els.destinationName.textContent = destination.name;
        els.destinationCoords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        els.destinationInput.value = name || '';
        els.mapClickHint.classList.add('hidden');
        if (center) map.flyTo([lat, lng], Math.max(map.getZoom(), 18), { duration: 0.6 });

        if (!name) {
            const resolved = await reverseName(lat, lng);
            if (resolved && destination && Math.abs(destination.lat - lat) < 1e-7 && Math.abs(destination.lng - lng) < 1e-7) {
                destination.name = resolved.name;
                els.destinationName.textContent = resolved.name;
                els.destinationInput.value = resolved.name;
            }
        }
    }

    async function setManualStart(lat, lng, name = null, center = false) {
        manualStart = { lat, lng, name: name || 'Điểm bắt đầu đã chọn' };
        if (!manualStartMarker) {
            manualStartMarker = L.marker([lat, lng], { icon: manualStartIcon(), zIndexOffset: 950 }).addTo(map);
        } else {
            manualStartMarker.setLatLng([lat, lng]);
        }
        els.manualStartName.textContent = manualStart.name;
        els.startSearchInput.value = manualStart.name;
        els.manualStartCoords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        pickingManualStart = false;
        els.pickManualStart.classList.remove('active');
        els.pickManualStart.innerHTML = '<span>✓</span> Đã chọn điểm đầu · bấm để chọn lại';
        els.mapClickHint.textContent = 'Bấm vào bản đồ để chọn điểm đến';
        if (center) map.flyTo([lat, lng], Math.max(map.getZoom(), 18), { duration: 0.6 });

        if (!name) {
            const resolved = await reverseName(lat, lng);
            if (resolved && manualStart && Math.abs(manualStart.lat - lat) < 1e-7 && Math.abs(manualStart.lng - lng) < 1e-7) {
                manualStart.name = resolved.name;
                els.manualStartName.textContent = resolved.name;
            }
        }
    }

    function beginManualStartPick() {
        if (startMode !== 'manual') return;
        pickingManualStart = true;
        els.pickManualStart.classList.add('active');
        els.pickManualStart.innerHTML = '<span>⌖</span> Đang chọn điểm đầu · bấm lên bản đồ';
        els.mapClickHint.textContent = 'CHỌN ĐIỂM BẮT ĐẦU: bấm một vị trí trên bản đồ';
    }

    function setStartMode(mode) {
        startMode = mode;
        els.startModeSwitch.querySelectorAll('.start-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        els.gpsModePanel.hidden = mode !== 'gps';
        els.manualModePanel.hidden = mode !== 'manual';
        clearRouteOnly();

        if (mode === 'manual') {
            followMode = false;
            els.followMe.classList.remove('active');
            if (tracking) stopTracking();
            if (!manualStart) beginManualStartPick();
            else {
                pickingManualStart = false;
                els.mapClickHint.textContent = 'Bấm vào bản đồ để chọn điểm đến';
            }
        } else {
            pickingManualStart = false;
            els.mapClickHint.textContent = 'Bấm vào bản đồ để chọn điểm đến';
            followMode = true;
            els.followMe.classList.add('active');
        }
    }

    function getActiveStart() {
        if (startMode === 'manual') return manualStart;
        return currentPosition ? { ...currentPosition, name: 'Vị trí GPS của bạn' } : null;
    }

    function clearRouteOnly() {
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (snappedStartMarker) {
            map.removeLayer(snappedStartMarker);
            snappedStartMarker = null;
        }
        els.routeTitle.textContent = 'Chưa có lộ trình';
        els.routeDistance.textContent = '—';
        els.routeTime.textContent = '—';
        els.routeRemaining.textContent = '—';
        els.routeStateBadge.textContent = 'Sẵn sàng';
        els.emptyRoute.hidden = false;
        els.routeSteps.hidden = true;
        els.routeSteps.innerHTML = '';
        els.navigationActions.hidden = true;
        routeData = null;
        activeRouteSteps = [];
        activeStepIndex = 0;
        lastSpokenStepIndex = -1;
        if (navigationActive) stopNavigation(false);
        lastRoutePosition = null;
    }

    function clearAll() {
        clearRouteOnly();
        destination = null;
        if (startMode === 'manual') {
            manualStart = null;
            if (manualStartMarker) {
                map.removeLayer(manualStartMarker);
                manualStartMarker = null;
            }
            els.manualStartName.textContent = 'Chưa chọn';
            els.manualStartCoords.textContent = 'Tìm tên địa điểm hoặc bấm một vị trí trên bản đồ.';
            els.startSearchInput.value = '';
            els.startSuggestions.classList.remove('show');
            els.startSuggestions.innerHTML = '';
            els.pickManualStart.innerHTML = '<span>⌖</span> Bấm vào bản đồ để chọn điểm bắt đầu';
            beginManualStartPick();
        }
        if (destinationMarker) {
            map.removeLayer(destinationMarker);
            destinationMarker = null;
        }
        els.destinationInput.value = '';
        els.destinationName.textContent = 'Chưa chọn';
        els.destinationCoords.textContent = 'Bấm vào một vị trí trên bản đồ.';
        els.suggestions.classList.remove('show');
        els.suggestions.innerHTML = '';
        els.mapClickHint.classList.remove('hidden');
        map.fitBounds(CAMPUS_BOUNDS, { padding: [20, 20] });
    }

    function speak(text, force = false) {
        if (!voiceEnabled || !('speechSynthesis' in window) || !text) return;
        if (!force && window.speechSynthesis.speaking) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    }

    function maneuverIcon(step) {
        const modifier = step?.maneuver?.modifier || '';
        const type = step?.maneuver?.type || '';
        if (type === 'arrive') return '●';
        if (modifier.includes('left')) return '↰';
        if (modifier.includes('right')) return '↱';
        if (modifier === 'uturn') return '↶';
        return '↑';
    }

    function stepPoint(step) {
        const loc = step?.maneuver?.location;
        return Array.isArray(loc) && loc.length === 2 ? { lat: loc[1], lng: loc[0] } : null;
    }

    function updateNavigationInstruction(position) {
        if (!navigationActive || !activeRouteSteps.length || !position) return;

        while (activeStepIndex < activeRouteSteps.length - 1) {
            const next = activeRouteSteps[activeStepIndex + 1];
            const point = stepPoint(next);
            if (!point) break;
            const dist = distanceMeters(position, point);
            if (dist <= 14) activeStepIndex += 1;
            else break;
        }

        const current = activeRouteSteps[Math.min(activeStepIndex, activeRouteSteps.length - 1)];
        const next = activeRouteSteps[Math.min(activeStepIndex + 1, activeRouteSteps.length - 1)];
        const targetPoint = stepPoint(next) || stepPoint(current);
        const distanceToTurn = targetPoint ? distanceMeters(position, targetPoint) : 0;
        const instruction = translateManeuver(next || current);

        els.navTurnIcon.textContent = maneuverIcon(next || current);
        els.navDistanceToTurn.textContent = (next?.maneuver?.type === 'arrive' && distanceToTurn < 18)
            ? 'Sắp đến nơi'
            : formatDistance(distanceToTurn);
        els.navInstruction.textContent = instruction;
        els.navStreet.textContent = (next || current)?.name || 'Theo tuyến đường được tô đỏ';

        const shouldSpeak = activeStepIndex !== lastSpokenStepIndex || distanceToTurn <= 35;
        if (shouldSpeak) {
            const prefix = distanceToTurn > 15 ? `Sau ${formatDistance(distanceToTurn)}, ` : '';
            speak(`${prefix}${instruction}`);
            lastSpokenStepIndex = activeStepIndex;
        }

        const remaining = destination ? distanceMeters(position, destination) : Infinity;
        els.routeRemaining.textContent = formatDistance(remaining);
        if (remaining <= 15) {
            els.navDistanceToTurn.textContent = 'Đã đến';
            els.navInstruction.textContent = 'Bạn đã đến điểm đích';
            els.navTurnIcon.textContent = '✓';
            speak('Bạn đã đến điểm đích', true);
            stopNavigation(false);
        }
    }

    function startNavigation() {
        if (!routeData || !destination) return;
        if (startMode !== 'gps') {
            els.routeStateBadge.textContent = 'Cần GPS';
            els.routeTitle.textContent = 'Chế độ dẫn đường trực tiếp cần chọn “GPS của tôi”';
            return;
        }
        if (!tracking) startTracking();
        navigationActive = true;
        followMode = true;
        activeStepIndex = 0;
        lastSpokenStepIndex = -1;
        els.navigationBanner.hidden = false;
        els.beginNavigation.textContent = 'Đang dẫn đường';
        els.beginNavigation.disabled = true;
        els.routeStateBadge.textContent = 'Đang điều hướng';
        els.followMe.classList.add('active');
        if (currentPosition) {
            map.flyTo([currentPosition.lat, currentPosition.lng], 19, { duration: 0.6 });
            if (userMarker) userMarker.setIcon(userIcon(true, currentPosition.heading));
            updateNavigationInstruction(currentPosition);
        }
        speak('Bắt đầu dẫn đường. Hãy di chuyển theo hướng dẫn trên bản đồ.', true);
    }

    function stopNavigation(announce = true) {
        if (!navigationActive && els.navigationBanner.hidden) return;
        navigationActive = false;
        els.navigationBanner.hidden = true;
        els.beginNavigation.disabled = false;
        els.beginNavigation.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z"></path></svg>Bắt đầu dẫn đường';
        if (userMarker && currentPosition) userMarker.setIcon(userIcon(false, currentPosition.heading));
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (announce) els.routeStateBadge.textContent = 'Đã dừng';
    }

    function translateManeuver(step) {
        const type = step.maneuver?.type || '';
        const modifier = step.maneuver?.modifier || '';
        const road = step.name ? ` vào ${step.name}` : '';
        const mapModifier = {
            left: 'rẽ trái', right: 'rẽ phải', straight: 'đi thẳng',
            'slight left': 'chếch trái', 'slight right': 'chếch phải',
            'sharp left': 'rẽ gấp trái', 'sharp right': 'rẽ gấp phải', uturn: 'quay đầu'
        };

        if (type === 'depart') return `Bắt đầu và ${mapModifier[modifier] || 'đi theo lối đi'}${road}`;
        if (type === 'arrive') return 'Bạn đã đến điểm đích';
        if (type === 'turn' || type === 'continue' || type === 'new name') return `${mapModifier[modifier] || 'tiếp tục'}${road}`;
        if (type === 'roundabout' || type === 'rotary') return `Đi vào vòng xuyến${road}`;
        return `${mapModifier[modifier] || 'Tiếp tục'}${road}`;
    }

    function renderSteps(steps) {
        const useful = steps.filter(step => step.distance > 2 || step.maneuver?.type === 'arrive').slice(0, 8);
        if (!useful.length) {
            els.routeSteps.hidden = true;
            return;
        }
        els.routeSteps.hidden = false;
        els.routeSteps.innerHTML = useful.map((step, index) => `
            <div class="route-step">
                <span class="step-dot">${index + 1}</span>
                <div class="step-copy">
                    <strong>${translateManeuver(step)}</strong>
                    <span>${formatDistance(step.distance)}</span>
                </div>
            </div>
        `).join('');
    }

    async function requestRoute({ fit = false, reason = 'manual' } = {}) {
        if (!destination) {
            els.destinationName.textContent = 'Hãy chọn điểm đến';
            return;
        }
        const activeStart = getActiveStart();
        if (!activeStart) {
            if (startMode === 'gps') {
                startTracking();
                els.routeStateBadge.textContent = 'Đợi GPS';
            } else {
                beginManualStartPick();
                els.routeStateBadge.textContent = 'Chọn điểm đầu';
            }
            return;
        }
        if (routingBusy) return;
        if (startMode === 'gps' && activeStart.accuracy > 80) {
            els.routeStateBadge.textContent = 'GPS yếu';
            return;
        }

        routingBusy = true;
        els.routeStateBadge.textContent = reason === 'auto' ? 'Đang cập nhật…' : 'Đang tính…';

        const start = activeStart;
        const end = destination;
        const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
        const url = `${ROUTING_BASE}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;

        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.code !== 'Ok' || !data.routes?.length) throw new Error('NoRoute');

            const route = data.routes[0];
            routeData = route;
            activeRouteSteps = route.legs?.flatMap(leg => leg.steps || []) || [];
            activeStepIndex = 0;
            const geojson = route.geometry;
            if (routeLayer) map.removeLayer(routeLayer);
            routeLayer = L.geoJSON(geojson, {
                style: { color: '#D31145', weight: 6, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }
            }).addTo(map);

            const snapped = data.waypoints?.[0]?.location;
            if (snapped?.length === 2) {
                const snappedLatLng = [snapped[1], snapped[0]];
                if (!snappedStartMarker) {
                    snappedStartMarker = L.marker(snappedLatLng, { icon: snappedIcon(), interactive: false }).addTo(map);
                } else {
                    snappedStartMarker.setLatLng(snappedLatLng);
                }
            }

            const startLabel = startMode === 'gps' ? 'Vị trí GPS của bạn' : (manualStart?.name || 'Điểm bắt đầu');
            els.routeTitle.textContent = `${startLabel} → ${destination.name}`;
            els.routeDistance.textContent = formatDistance(route.distance);
            els.routeTime.textContent = formatDuration(route.duration);
            els.routeRemaining.textContent = formatDistance(distanceMeters(start, destination));
            els.routeStateBadge.textContent = reason === 'auto' ? 'Đã cập nhật' : 'Đang dẫn đường';
            els.emptyRoute.hidden = true;
            renderSteps(activeRouteSteps);
            els.navigationActions.hidden = false;
            if (startMode !== 'gps') {
                els.beginNavigation.disabled = true;
                els.beginNavigation.textContent = 'Chọn GPS để điều hướng trực tiếp';
            } else {
                els.beginNavigation.disabled = false;
                els.beginNavigation.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z"></path></svg>Bắt đầu dẫn đường';
            }

            lastRoutePosition = startMode === 'gps' ? { lat: start.lat, lng: start.lng } : null;
            lastRouteAt = Date.now();
            if (fit) map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
        } catch (error) {
            console.error('Routing failed:', error);
            els.routeStateBadge.textContent = 'Không có tuyến';
            els.routeTitle.textContent = 'Không lấy được tuyến đi bộ';
            els.emptyRoute.hidden = false;
            els.emptyRoute.querySelector('p').textContent = 'Dịch vụ định tuyến đang không phản hồi hoặc đường đi chưa có trong dữ liệu OpenStreetMap. Bạn vẫn có thể xem vị trí GPS và điểm đích trên bản đồ.';
        } finally {
            routingBusy = false;
        }
    }

    function maybeAutoReroute() {
        if (startMode !== 'gps' || !destination || !currentPosition || routingBusy || currentPosition.accuracy > MIN_GOOD_ACCURACY) return;
        if (!lastRoutePosition) {
            requestRoute({ fit: false, reason: 'auto' });
            return;
        }
        const moved = distanceMeters(currentPosition, lastRoutePosition);
        const elapsed = Date.now() - lastRouteAt;
        if (moved >= REROUTE_DISTANCE && elapsed >= REROUTE_INTERVAL) {
            requestRoute({ fit: false, reason: 'auto' });
        }
    }

    function onPosition(position) {
        latestRawPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || 999,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
        };
        currentPosition = smoothPosition(latestRawPosition);
        updateUserOnMap(currentPosition);
        if (navigationActive) updateNavigationInstruction(currentPosition);
        maybeAutoReroute();
    }

    function onPositionError(error) {
        const messages = {
            1: 'Bạn chưa cấp quyền Location cho trình duyệt.',
            2: 'Thiết bị chưa xác định được vị trí.',
            3: 'Quá thời gian chờ GPS.'
        };
        els.gpsStatus.textContent = 'Không lấy được GPS';
        els.gpsAccuracy.textContent = messages[error.code] || 'Lỗi GPS không xác định.';
        els.currentLocationName.textContent = 'GPS không khả dụng';
        els.currentLocationDetail.textContent = 'Hãy kiểm tra quyền vị trí và thử lại ngoài trời.';
        if (error.code === 1) stopTracking();
    }

    function startTracking() {
        if (tracking) return;
        if (!navigator.geolocation) {
            els.gpsStatus.textContent = 'Trình duyệt không hỗ trợ GPS';
            return;
        }
        if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            els.gpsStatus.textContent = 'GPS cần HTTPS hoặc localhost';
            els.gpsAccuracy.textContent = 'Hãy chạy project bằng localhost khi phát triển, hoặc HTTPS khi triển khai.';
            return;
        }

        setTrackingUI(true);
        els.gpsAccuracy.textContent = 'Đang chờ tín hiệu GPS…';
        watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        });
    }

    function stopTracking() {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        setTrackingUI(false);
        els.gpsAccuracy.textContent = currentPosition
            ? `Đã dừng · vị trí cuối có sai số ±${Math.round(currentPosition.accuracy)} m`
            : 'Theo dõi GPS đã dừng.';
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

    function escapeOverpassRegex(value) {
        return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    }

    async function searchCampusObjects(query, signal) {
        const south = 10.73055;
        const west = 106.69845;
        const north = 10.73320;
        const east = 106.70035;
        const safeQuery = escapeOverpassRegex(query);

        const overpassQuery = `
            [out:json][timeout:10];
            (
              nwr["name"~"${safeQuery}",i](${south},${west},${north},${east});
              nwr["official_name"~"${safeQuery}",i](${south},${west},${north},${east});
              nwr["short_name"~"${safeQuery}",i](${south},${west},${north},${east});
            );
            out center tags;
        `;

        const response = await fetch(
            `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
            { signal, headers: { 'Accept': 'application/json' } }
        );
        if (!response.ok) return [];

        const data = await response.json();
        return (data.elements || []).map(element => {
            const lat = element.lat ?? element.center?.lat;
            const lng = element.lon ?? element.center?.lon;
            const name = element.tags?.name || element.tags?.official_name || element.tags?.short_name;
            if (!lat || !lng || !name) return null;

            const detailParts = [
                element.tags?.building ? 'Tòa nhà' : null,
                element.tags?.amenity,
                element.tags?.shop,
                'Trường Đại học Tôn Đức Thắng'
            ].filter(Boolean);

            return {
                lat: Number(lat),
                lon: Number(lng),
                name,
                display_name: `${name}${detailParts.length ? ', ' + detailParts.join(', ') : ''}`,
                source: 'overpass'
            };
        }).filter(Boolean);
    }

    async function searchNominatimCampus(query, signal) {
        const left = 106.69845;
        const right = 106.70035;
        const top = 10.73320;
        const bottom = 10.73055;

        const queries = [
            query,
            `${query}, Trường Đại học Tôn Đức Thắng, Hồ Chí Minh`
        ];

        const all = [];
        for (const q of queries) {
            const url = `${NOMINATIM_BASE}?format=jsonv2&limit=15&addressdetails=1&namedetails=1&bounded=1&viewbox=${left},${top},${right},${bottom}&q=${encodeURIComponent(q)}`;
            const response = await fetch(url, {
                signal,
                headers: { 'Accept': 'application/json', 'Accept-Language': 'vi' }
            });
            if (!response.ok) continue;
            const results = await response.json();
            all.push(...results);
        }
        return all;
    }

    function mergeAndRankResults(query, osmObjects, nominatimResults) {
        const nq = normalise(query);
        const merged = [];
        const seen = new Set();

        [...osmObjects, ...nominatimResults].forEach(item => {
            const lat = Number(item.lat);
            const lng = Number(item.lon ?? item.lng);
            const name = item.name || item.namedetails?.name || (item.display_name || '').split(',')[0] || 'Địa điểm';
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            const key = `${name.toLowerCase()}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
            if (seen.has(key)) return;
            seen.add(key);

            const nn = normalise(name);
            let score = 0;
            if (nn === nq) score += 100;
            else if (nn.startsWith(nq)) score += 70;
            else if (nn.includes(nq)) score += 50;
            if (item.source === 'overpass') score += 20;

            merged.push({
                lat,
                lng,
                name,
                display_name: item.display_name || name,
                score
            });
        });

        return merged.sort((a, b) => b.score - a.score).slice(0, 12);
    }

    async function searchOSMFor(inputEl, suggestionsEl, kind) {
        const query = inputEl.value.trim();
        if (!query) {
            suggestionsEl.classList.remove('show');
            return;
        }

        if (kind === 'start') {
            if (startSearchAbortController) startSearchAbortController.abort();
            startSearchAbortController = new AbortController();
        } else {
            if (destinationSearchAbortController) destinationSearchAbortController.abort();
            destinationSearchAbortController = new AbortController();
        }
        const controller = kind === 'start' ? startSearchAbortController : destinationSearchAbortController;

        suggestionsEl.innerHTML = '<div class="suggestion-loading">Đang tìm trong dữ liệu OpenStreetMap của khuôn viên…</div>';
        suggestionsEl.classList.add('show');

        try {
            let osmObjects = [];
            let nominatimResults = [];

            try {
                osmObjects = await searchCampusObjects(query, controller.signal);
            } catch (error) {
                if (error.name === 'AbortError') throw error;
            }

            try {
                nominatimResults = await searchNominatimCampus(query, controller.signal);
            } catch (error) {
                if (error.name === 'AbortError') throw error;
            }

            const results = mergeAndRankResults(query, osmObjects, nominatimResults);

            if (!results.length) {
                suggestionsEl.innerHTML = '<div class="suggestion-loading">Không tìm thấy đối tượng có tên này trong dữ liệu OSM của khuôn viên. Bạn vẫn có thể bấm trực tiếp lên bản đồ.</div>';
                suggestionsEl.dataset.results = '[]';
                return;
            }

            suggestionsEl.innerHTML = results.map((item, index) => `
                <button type="button" class="suggestion-item osm-result" data-index="${index}">
                    <span class="suggestion-icon">⌖</span>
                    <span class="suggestion-text">
                        <strong>${item.name}</strong>
                        <small>${item.display_name}</small>
                    </span>
                </button>
            `).join('');

            suggestionsEl.dataset.results = JSON.stringify(results);
        } catch (error) {
            if (error.name !== 'AbortError') {
                suggestionsEl.innerHTML = '<div class="suggestion-loading">Không thể tìm kiếm lúc này. Bạn vẫn có thể bấm trực tiếp lên bản đồ.</div>';
            }
        }
    }

    function searchDestinationOSM() {
        return searchOSMFor(els.destinationInput, els.suggestions, 'destination');
    }

    function searchStartOSM() {
        return searchOSMFor(els.startSearchInput, els.startSuggestions, 'start');
    }

    map.on('click', event => {
        const { lat, lng } = event.latlng;
        if (startMode === 'manual' && pickingManualStart) {
            setManualStart(lat, lng, null, false);
            clearRouteOnly();
            return;
        }
        setDestination(lat, lng, null, false);
        clearRouteOnly();
    });

    els.startModeSwitch.addEventListener('click', event => {
        const btn = event.target.closest('[data-mode]');
        if (!btn) return;
        setStartMode(btn.dataset.mode);
    });
    els.pickManualStart.addEventListener('click', beginManualStartPick);

    els.toggleTracking.addEventListener('click', () => tracking ? stopTracking() : startTracking());
    els.startRoute.addEventListener('click', () => requestRoute({ fit: true, reason: 'manual' }));
    els.resetRoute.addEventListener('click', clearAll);
    els.searchDestination.addEventListener('click', searchDestinationOSM);
    els.searchStart.addEventListener('click', searchStartOSM);
    els.destinationInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchDestinationOSM();
    });
    els.destinationInput.addEventListener('input', () => {
        if (!els.destinationInput.value.trim()) els.suggestions.classList.remove('show');
    });
    els.startSearchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchStartOSM();
    });
    els.startSearchInput.addEventListener('input', () => {
        if (!els.startSearchInput.value.trim()) els.startSuggestions.classList.remove('show');
    });

    els.suggestions.addEventListener('click', event => {
        const btn = event.target.closest('[data-index]');
        if (!btn) return;
        const results = JSON.parse(els.suggestions.dataset.results || '[]');
        const item = results[Number(btn.dataset.index)];
        if (!item) return;
        els.suggestions.classList.remove('show');
        setDestination(item.lat, item.lng, item.name || item.display_name, true);
        clearRouteOnly();
    });

    els.startSuggestions.addEventListener('click', event => {
        const btn = event.target.closest('[data-index]');
        if (!btn) return;
        const results = JSON.parse(els.startSuggestions.dataset.results || '[]');
        const item = results[Number(btn.dataset.index)];
        if (!item) return;
        els.startSuggestions.classList.remove('show');
        setManualStart(item.lat, item.lng, item.name || item.display_name, true);
        clearRouteOnly();
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.destination-search-wrap')) els.suggestions.classList.remove('show');
        if (!event.target.closest('.start-search-wrap')) els.startSuggestions.classList.remove('show');
    });

    els.followMe.addEventListener('click', () => {
        if (startMode !== 'gps') return;
        followMode = !followMode;
        els.followMe.classList.toggle('active', followMode);
        if (followMode && currentPosition) map.flyTo([currentPosition.lat, currentPosition.lng], Math.max(map.getZoom(), 18));
    });
    els.followMe.classList.add('active');

    els.beginNavigation.addEventListener('click', startNavigation);
    els.endNavigation.addEventListener('click', () => stopNavigation(true));
    els.voiceToggle.addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        els.voiceToggle.classList.toggle('active', voiceEnabled);
        els.voiceToggle.textContent = voiceEnabled ? '🔊' : '🔇';
        if (!voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
        if (voiceEnabled) speak('Hướng dẫn bằng giọng nói đã bật', true);
    });

    els.zoomIn.addEventListener('click', () => map.zoomIn());
    els.zoomOut.addEventListener('click', () => map.zoomOut());
    map.on('zoomend', () => { els.zoomValue.textContent = String(map.getZoom()); });

    setStartMode('gps');

    const params = new URLSearchParams(location.search);
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    const name = params.get('name');
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setDestination(lat, lng, name || 'Điểm từ bản đồ', true);
    }
    if (params.get('mode') === 'mylocation') startTracking();

    map.fitBounds(CAMPUS_BOUNDS, { padding: [20, 20] });
    els.zoomValue.textContent = String(map.getZoom());
});
