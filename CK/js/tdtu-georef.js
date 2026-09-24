/*
 * TDTU 2D <-> GPS georeference layer
 * Canonical image: image/official-map/tdtu-campus-full.png (1439 x 772)
 *
 * IMPORTANT:
 * Discovery TDTU is an isometric illustrated map, not a north-up survey map.
 * These control points provide a practical projective bootstrap only.
 * Add/replace anchors with field-surveyed GPS points later for higher accuracy.
 */
window.TDTUGeoRef = (() => {
    const IMAGE_WIDTH = 1439;
    const IMAGE_HEIGHT = 772;

    const anchors = [
        {
            id: 'vfis', name: 'Trường VFIS',
            pixel: { x: 1144.3828, y: 229.1406 },
            geo: { lat: 10.73243, lng: 106.69497 },
            source: 'OpenStreetMap/Mapcarta'
        },
        {
            id: 'building-f', name: 'Tòa F',
            pixel: { x: 316.8178, y: 338.9591 },
            geo: { lat: 10.73079, lng: 106.69894 },
            source: 'OpenStreetMap/Mapcarta'
        },
        {
            id: 'building-g', name: 'Tòa G - Thư viện truyền cảm hứng',
            pixel: { x: 251.4375, y: 389.8473 },
            geo: { lat: 10.73079, lng: 106.69943 },
            source: 'OpenStreetMap/Mapcarta'
        },
        {
            id: 'statue', name: 'Tượng Tôn Đức Thắng',
            pixel: { x: 370.3453, y: 517.8490 },
            geo: { lat: 10.73197, lng: 106.69952 },
            source: 'OpenStreetMap/Mapcarta'
        },
        {
            id: 'qpan', name: 'Trung tâm QPAN',
            pixel: { x: 450.3564, y: 268.0070 },
            geo: { lat: 10.73058, lng: 106.69811 },
            source: 'OpenStreetMap/Mapcarta'
        }
    ];

    // Projective matrix fitted from the bootstrap anchors above.
    const H = [
        [-40.9008861620669, 23.9714714819904, 4106.91789020557],
        [12.6097810933444, 19.4229755462831, -1553.80115117837],
        [-0.00883091420493965, -0.00536213072216087, 1]
    ];

    const H_INV = [
        [-43.4018293501796, 179.97846324144, 457898.492797765],
        [-4.35025732115377, 18.1297835648095, 46036.2281928598],
        [-0.406604479759932, 1.68658863706103, 4291.51457799358]
    ];

    function applyMatrix(M, a, b) {
        const d = M[2][0] * a + M[2][1] * b + M[2][2];
        if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
        return {
            a: (M[0][0] * a + M[0][1] * b + M[0][2]) / d,
            b: (M[1][0] * a + M[1][1] * b + M[1][2]) / d
        };
    }

    function gpsToPixel(lat, lng) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const p = applyMatrix(H, lng, lat);
        if (!p) return null;
        return { x: p.a, y: p.b };
    }

    function pixelToGps(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const g = applyMatrix(H_INV, x, y);
        if (!g) return null;
        return { lng: g.a, lat: g.b };
    }

    function isPixelOnMap(p, margin = 70) {
        return p && p.x >= -margin && p.y >= -margin && p.x <= IMAGE_WIDTH + margin && p.y <= IMAGE_HEIGHT + margin;
    }

    return {
        imageWidth: IMAGE_WIDTH,
        imageHeight: IMAGE_HEIGHT,
        anchors,
        gpsToPixel,
        pixelToGps,
        isPixelOnMap,
        note: 'Bootstrap georeference. Replace/add surveyed control points before claiming indoor/survey-grade accuracy.'
    };
})();
