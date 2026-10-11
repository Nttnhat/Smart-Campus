import json
import math
import requests

OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
]

# Tọa độ bounding box dự phòng bao trọn khuôn viên TDTU Tân Phong
SOUTH = 10.7298
WEST  = 106.6940
NORTH = 10.7356
EAST  = 106.7032

EXCLUDED_STREETS = [
    'Nguyễn Hữu Thọ',
    'Đường D6',
    'Đường D1',
]

def haversine(lat1, lon1, lat2, lon2):
    """Tính khoảng cách thực tế giữa 2 tọa độ GPS (mét)."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2)**2
    return round(2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)

def normalize_road_type(osm_highway):
    """Ánh xạ phân loại đường về 5 giá trị ENUM của bảng road_edges."""
    mapping = {
        'footway': 'footway',
        'pedestrian': 'footway',
        'path': 'footway',
        'corridor': 'footway',
        'steps': 'steps',
        'service': 'service',
        'crossing': 'crossing',
        'residential': 'road',
        'living_street': 'road',
        'unclassified': 'road',
        'tertiary': 'road'
    }
    return mapping.get(osm_highway, 'footway')

def get_route_factor(highway):
    """Hệ số trọng số chi phí di chuyển bộ."""
    factors = {
        'pedestrian': 0.96,
        'footway': 1.00,
        'service': 1.04,
        'living_street': 1.08,
        'residential': 1.14,
        'unclassified': 1.14,
        'path': 1.32,
        'steps': 1.55
    }
    return factors.get(highway, 1.15)

def fetch_overpass_data():
    """
    Truy vấn Overpass ưu tiên lọc theo diện tích khuôn viên (area.campus).
    Nếu area không trả về kết quả, fallback sang bounding box bên trong khuôn viên.
    """
    query_area = """
    [out:json][timeout:35];
    (
      area["name"="Trường Đại học Tôn Đức Thắng"];
      area["short_name"="TDTU"];
    )->.campus;
    (
      way["highway"~"^(footway|path|pedestrian|service|steps)$"](area.campus);
      way["building"](area.campus);
      way["natural"="water"](area.campus);
      way["waterway"](area.campus);
      way["leisure"](area.campus);
      way["landuse"="grass"](area.campus);
    );
    out geom tags;
    """

    query_bbox = f"""
    [out:json][timeout:35];
    (
      way["highway"~"^(footway|path|pedestrian|service|steps)$"]({SOUTH},{WEST},{NORTH},{EAST});
      way["building"]({SOUTH},{WEST},{NORTH},{EAST});
      way["natural"="water"]({SOUTH},{WEST},{NORTH},{EAST});
      way["waterway"]({SOUTH},{WEST},{NORTH},{EAST});
      way["leisure"]({SOUTH},{WEST},{NORTH},{EAST});
      way["landuse"="grass"]({SOUTH},{WEST},{NORTH},{EAST});
    );
    out geom tags;
    """

    headers = {
        'User-Agent': 'TDTU-SmartCampus-Importer/1.0 (contact: student@tdtu.edu.vn)',
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }

    for query in [query_area, query_bbox]:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                print(f"⏳ Đang gửi truy vấn đến: {endpoint}...")
                res = requests.post(endpoint, data={'data': query}, headers=headers, timeout=40)
                if res.status_code == 200:
                    elements = res.json().get('elements', [])
                    if elements:
                        print(f" Tải thành công {len(elements)} đối tượng!")
                        return elements
                else:
                    print(f"⚠️ {endpoint} trả về mã {res.status_code}, đang chuyển mirror...")
            except Exception as e:
                print(f"⚠️ Lỗi kết nối {endpoint}: {e}")
                continue

    raise RuntimeError("Không thể tải dữ liệu từ tất cả các máy chủ Overpass.")

def main():
    elements = fetch_overpass_data()
    print(" Bắt đầu lọc đường nội bộ và tạo câu lệnh SQL...")

    nodes = {}  # key: (round(lat, 7), round(lng, 7)) -> node_id
    node_id_counter = 1

    road_edges = []
    map_features = []

    for el in elements:
        tags = el.get('tags', {})
        pts = el.get('geometry', [])
        if len(pts) < 2:
            continue

        # ----------------------------------------------------
        # 1. MAP_FEATURES (Polygon nền tòa nhà, sân bãi, cây xanh)
        # ----------------------------------------------------
        if tags.get('building') or tags.get('natural') == 'water' or tags.get('waterway') or tags.get('landuse') == 'grass' or tags.get('leisure'):
            if len(pts) >= 3:
                name = tags.get('name', '').replace("'", "''")
                ftype = 'other'
                style = {}

                if tags.get('building'):
                    ftype = 'other'
                    name = name or 'Khối nhà'
                    style = {"color": "#56708d", "fillColor": "#dbe5ef", "fillOpacity": 0.42}
                elif tags.get('natural') == 'water' or tags.get('waterway'):
                    ftype = 'other'
                    name = name or 'Mặt nước'
                    style = {"color": "#6aa7c8", "fillColor": "#bfe5f3", "fillOpacity": 0.48}
                elif tags.get('landuse') == 'grass' or tags.get('leisure'):
                    ftype = 'pedestrian_zone'
                    name = name or 'Khu cây xanh / Sân thể thao'
                    style = {"color": "#3e8f5c", "fillColor": "#bde0b8", "fillOpacity": 0.45}

                poly_pts = [[p['lon'], p['lat']] for p in pts]
                if poly_pts[0] != poly_pts[-1]:
                    poly_pts.append(poly_pts[0])

                wkt_pts = ", ".join([f"{p[0]} {p[1]}" for p in poly_pts])
                wkt = f"POLYGON(({wkt_pts}))"

                map_features.append(
                    f"('{ftype}', '{name}', ST_GeomFromText('{wkt}', 4326), '{json.dumps(style)}')"
                )

        # ----------------------------------------------------
        # 2. ROAD_NODES & ROAD_EDGES (Đường đi bộ nội bộ)
        # ----------------------------------------------------
        if 'highway' in tags:
            raw_highway = tags.get('highway', 'footway')
            road_name = tags.get('name', 'Đường nội bộ TDTU').replace("'", "''")

            # Bỏ qua các trục đường bên ngoài khuôn viên
            if any(ext.lower() in road_name.lower() for ext in EXCLUDED_STREETS):
                continue

            # Bỏ qua đường lộ xe cơ giới lớn
            if raw_highway in ['primary', 'secondary', 'tertiary', 'trunk', 'motorway']:
                continue

            if tags.get('access') in ['no', 'private'] or tags.get('foot') == 'no':
                continue

            db_road_type = normalize_road_type(raw_highway)
            factor = get_route_factor(raw_highway)
            one_way = tags.get('oneway') in ['yes', '1']
            pedestrian_only = 1 if db_road_type in ['footway', 'steps', 'crossing'] else 0

            for i in range(len(pts) - 1):
                p1 = pts[i]
                p2 = pts[i + 1]

                k1 = (round(p1['lat'], 7), round(p1['lon'], 7))
                k2 = (round(p2['lat'], 7), round(p2['lon'], 7))

                if k1 not in nodes:
                    nodes[k1] = node_id_counter
                    node_id_counter += 1
                if k2 not in nodes:
                    nodes[k2] = node_id_counter
                    node_id_counter += 1

                u = nodes[k1]
                v = nodes[k2]

                d = haversine(k1[0], k1[1], k2[0], k2[1])
                if d < 0.05:
                    continue

                wkt_edge = f"LINESTRING({k1[1]} {k1[0]}, {k2[1]} {k2[0]})"
                wkt_edge_rev = f"LINESTRING({k2[1]} {k2[0]}, {k1[1]} {k1[0]})"

                road_edges.append(
                    f"({u}, {v}, '{road_name}', '{db_road_type}', {d}, {factor}, {pedestrian_only}, ST_GeomFromText('{wkt_edge}', 4326))"
                )
                if not one_way:
                    road_edges.append(
                        f"({v}, {u}, '{road_name}', '{db_road_type}', {d}, {factor}, {pedestrian_only}, ST_GeomFromText('{wkt_edge_rev}', 4326))"
                    )

    output_sql = "insert_campus_graph.sql"
    with open(output_sql, "w", encoding="utf-8") as f:
        f.write("USE `smart_campus_tdtu`;\n\n")

        # 1. Chèn map_features
        if map_features:
            f.write("-- 1. DỮ LIỆU MAP_FEATURES\n")
            f.write("INSERT INTO `map_features` (`feature_type`, `name`, `geom`, `style_json`) VALUES\n")
            f.write(",\n".join(map_features))
            f.write(";\n\n")

        # 2. Chèn road_nodes
        if nodes:
            f.write("-- 2. DỮ LIỆU ROAD_NODES\n")
            f.write("INSERT INTO `road_nodes` (`id`, `lat`, `lng`, `geom`) VALUES\n")
            node_rows = [
                f"({nid}, {lat}, {lng}, ST_GeomFromText('POINT({lng} {lat})', 4326))"
                for (lat, lng), nid in nodes.items()
            ]
            f.write(",\n".join(node_rows))
            f.write(";\n\n")

        # 3. Chèn road_edges
        if road_edges:
            f.write("-- 3. DỮ LIỆU ROAD_EDGES\n")
            f.write("INSERT INTO `road_edges` (`from_node`, `to_node`, `name`, `road_type`, `length_m`, `cost_factor`, `pedestrian_only`, `geom`) VALUES\n")
            f.write(",\n".join(road_edges))
            f.write(";\n\n")

        # 4. Tự động gán node_id gần nhất cho place_entrances
        f.write("-- 4. RÀNG BUỘC KHÓA NGOẠI: LIÊN KẾT ENTRANCES VỚI ROAD_NODES GẦN NHẤT\n")
        f.write("""UPDATE `place_entrances` pe
JOIN (
    SELECT 
        pe_sub.id AS entrance_id,
        (
            SELECT rn.id 
            FROM `road_nodes` rn 
            ORDER BY ST_Distance_Sphere(rn.geom, pe_sub.geom) ASC 
            LIMIT 1
        ) AS closest_node_id
    FROM `place_entrances` pe_sub
) matched ON pe.id = matched.entrance_id
SET pe.node_id = matched.closest_node_id;
""")

    print(f" Hoàn thành! Đã tạo file '{output_sql}':")
    print(f"   - Số map_features: {len(map_features)}")
    print(f"   - Số road_nodes:   {len(nodes)}")
    print(f"   - Số road_edges:   {len(road_edges)}")
    print("   - Đã nhúng sẵn lệnh UPDATE khóa ngoại cho place_entrances.")

if __name__ == '__main__':
    main()