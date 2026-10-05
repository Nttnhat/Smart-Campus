// js/leaflet-config.js
const MapConfig = {
    // Shared locations database
    locations: {
        'Tòa A': { desc: 'Khu hành chính & Phòng học lý thuyết dành cho sinh viên.', lat: 10.7328, lng: 106.6990, hasFloors: true, cat: 'Tòa học' },
        'Tòa B': { desc: 'Phòng học lý thuyết và phòng thực hành.', lat: 10.7322, lng: 106.6993, hasFloors: true, cat: 'Tòa học' },
        'Tòa C': { desc: 'Tòa nhà văn phòng và các khoa.', lat: 10.7330, lng: 106.6998, hasFloors: true, cat: 'Tòa học' },
        'Sân bóng đá': { desc: 'Sân bóng đá cỏ nhân tạo tiêu chuẩn. Thích hợp cho các giải đấu và hoạt động ngoài trời.', lat: 10.7345, lng: 106.7015, hasFloors: false, cat: 'Các sân thể thao' },
        'Nhà thi đấu': { desc: 'Nhà thi đấu đa năng trong nhà với sức chứa lớn.', lat: 10.7335, lng: 106.7010, hasFloors: false, cat: 'Các sân thể thao' },
        'Sân Pickleball': { desc: 'Cụm sân Pickleball mới phục vụ môn thể thao đang hot.', lat: 10.7340, lng: 106.7020, hasFloors: false, cat: 'Các sân thể thao' },
        'Sân quốc phòng': { desc: 'Khu vực huấn luyện giáo dục quốc phòng.', lat: 10.7350, lng: 106.7025, hasFloors: false, cat: 'Các sân thể thao' },
        'Căn tin': { desc: 'Khu vực ăn uống chính của sinh viên với đa dạng các món ăn.', lat: 10.7315, lng: 106.6998, hasFloors: false, cat: 'Khu vực ăn uống' },
        'Sảnh 711': { desc: 'Khu vực ăn sáng và cà phê nhanh tại sảnh.', lat: 10.7320, lng: 106.6995, hasFloors: false, cat: 'Khu vực ăn uống' },
        'StartUp Coffee': { desc: 'Không gian cà phê lý tưởng để làm việc nhóm và thảo luận.', lat: 10.7325, lng: 106.6990, hasFloors: false, cat: 'Khu vực ăn uống' },
        '7-Eleven': { desc: 'Cửa hàng tiện lợi 24/7.', lat: 10.7318, lng: 106.6992, hasFloors: false, cat: 'Khu vực mua sắm' },
        'SMart': { desc: 'Siêu thị mini phục vụ nhu yếu phẩm.', lat: 10.7312, lng: 106.6999, hasFloors: false, cat: 'Khu vực mua sắm' },
        'Hầm xe Tòa A': { desc: 'Bãi đỗ xe máy dành cho sinh viên và giảng viên tại hầm Tòa A. Gồm lối ra và lối vào.', lat: 10.7328, lng: 106.6985, hasFloors: false, cat: 'Hầm xe' },
        'Hầm xe KTX': { desc: 'Bãi đỗ xe khu Ký túc xá.', lat: 10.7310, lng: 106.7010, hasFloors: false, cat: 'Hầm xe' },
        'Cổng 1': { desc: 'Cổng chính đường Nguyễn Hữu Thọ.', lat: 10.7325, lng: 106.6975, hasFloors: false, cat: 'Các cổng' },
        'Cổng 3': { desc: 'Cổng phụ đường Lê Văn Lương.', lat: 10.7300, lng: 106.6980, hasFloors: false, cat: 'Các cổng' },
        'Phòng C001': { desc: 'Phòng Công tác học sinh sinh viên. Giải quyết các thủ tục hành chính.', lat: 10.7330, lng: 106.6998, hasFloors: true, cat: 'Phòng ban hỗ trợ' },
        'Phòng A003': { desc: 'Phòng Đại học. Tư vấn và hỗ trợ học vụ.', lat: 10.7328, lng: 106.6990, hasFloors: true, cat: 'Phòng ban hỗ trợ' },
        'Tòa K': { desc: 'Khu vực phòng học và nghiên cứu (trước đây là tòa N).', lat: 10.7322, lng: 106.6989, hasFloors: true, cat: 'Tòa học' },
        'Tòa L': { desc: 'Khu vực dịch vụ, tiện ích (trước đây là tòa M).', lat: 10.7317, lng: 106.6990, hasFloors: true, cat: 'Tòa học' },
    },

    initMap: function (containerId, options = {}) {
        const CAMPUS_CENTER = [10.73182, 106.69943];
        const CAMPUS_BOUNDS = L.latLngBounds(
            [10.73055, 106.69845],
            [10.73320, 106.70035]
        );

        const center = options.center || [10.7326, 106.6997];
        const defaultOptions = {
            zoomControl: false,
            minZoom: 16,
            maxZoom: 20,
            maxBounds: CAMPUS_BOUNDS.pad(0.45),
            maxBoundsViscosity: 1.0
        };
        const map = L.map(containerId, { ...defaultOptions, ...options }).setView(center, options.zoom || 17);

        // Use MapLibre GL JS Vector Tiles via OpenFreeMap (Free, No API Key)
        L.maplibreGL({
            style: 'https://tiles.openfreemap.org/styles/bright',
            attribution: '&copy; OpenFreeMap &copy; OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Inject CSS for custom labels if not present
        if (!document.getElementById('css-label-styles')) {
            const style = document.createElement('style');
            style.id = 'css-label-styles';
            style.innerHTML = `
                .map-css-label {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(8px);
                    border: 2px solid #2563EB;
                    border-radius: 8px;
                    padding: 4px 10px;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 700;
                    font-size: 13px;
                    color: #1E40AF;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    white-space: nowrap;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: labelFadeIn 0.5s ease-out;
                }
                .map-css-label:hover {
                    background: #2563EB;
                    color: white;
                    transform: translateY(-4px) scale(1.05);
                    box-shadow: 0 8px 25px rgba(37,99,235,0.3);
                    z-index: 1000 !important;
                }
                .map-css-label.active {
                    background: #F59E0B;
                    border-color: #D97706;
                    color: white;
                    animation: pulse-label 1.5s infinite;
                    z-index: 1000 !important;
                }
                .custom-css-label-container {
                    background: transparent;
                    border: none;
                }
                @keyframes labelFadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-label {
                    0% { box-shadow: 0 0 0 0 rgba(245,158,11, 0.6); }
                    70% { box-shadow: 0 0 0 15px rgba(245,158,11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245,158,11, 0); }
                }
            `;
            document.head.appendChild(style);
        }

        return map;
    },

    createCssLabel: function (name, isActive = false) {
        return L.divIcon({
            className: 'custom-css-label-container',
            html: `<div class="map-css-label ${isActive ? 'active' : ''}">${name}</div>`,
            iconSize: [null, null], // Auto size based on content
            iconAnchor: [30, 15] // Center somewhat
        });
    },

    renderAllLabels: function (map, onLabelClick) {
        const markers = {};
        for (const [name, loc] of Object.entries(this.locations)) {
            const marker = L.marker([loc.lat, loc.lng], {
                icon: this.createCssLabel(name, false)
            }).addTo(map);

            if (onLabelClick) {
                marker.on('click', (e) => onLabelClick(name, e));
            }
            markers[name] = marker;
        }
        return markers;
    }
};
