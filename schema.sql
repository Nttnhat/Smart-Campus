-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Máy chủ: 127.0.0.1
-- Thời gian đã tạo: Th10 05, 2026 lúc 07:13 PM
-- Phiên bản máy phục vụ: 10.4.32-MariaDB
-- Phiên bản PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `smart_campus_tdtu`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `admins`
--

CREATE TABLE `admins` (
  `id` bigint(20) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `unit` varchar(150) DEFAULT NULL COMMENT 'Khoa/Bộ phận',
  `avatar_url` text DEFAULT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'active' COMMENT 'active | locked',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `admins`
--

INSERT INTO `admins` (`id`, `username`, `password_hash`, `full_name`, `email`, `phone`, `unit`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2y$10$wX7YpAiqUOz9L3.y4hK8se6P1hK9D/K.v1qC4XyJ1fM8O9b8dE0p2', 'Quản trị viên Campus TDTU', 'admin@tdtu.edu.vn', '0123456789', 'Phòng Quản trị thiết bị', NULL, 'active', '2026-10-06 00:12:45', '2026-10-06 00:12:45');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) NOT NULL,
  `admin_id` bigint(20) DEFAULT NULL,
  `action` varchar(10) NOT NULL COMMENT 'create | update | delete',
  `entity` varchar(50) NOT NULL COMMENT 'Tên bảng, vd: places',
  `entity_id` bigint(20) DEFAULT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_data`)),
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_data`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `buildings`
--

CREATE TABLE `buildings` (
  `place_id` bigint(20) NOT NULL,
  `code` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `floors`
--

CREATE TABLE `floors` (
  `id` bigint(20) NOT NULL,
  `building_id` bigint(20) NOT NULL,
  `level` int(11) NOT NULL COMMENT '0 = trệt (G), 1, 2, 3...',
  `name` varchar(50) NOT NULL,
  `floor_plan_svg` longtext DEFAULT NULL,
  `floor_plan_url` text DEFAULT NULL,
  `svg_view_box` varchar(50) DEFAULT NULL,
  `altitude_m` decimal(6,2) DEFAULT NULL,
  `status` varchar(15) NOT NULL DEFAULT 'active' COMMENT 'active | maintenance | closed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `georef_anchors`
--

CREATE TABLE `georef_anchors` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `pixel_x` double NOT NULL,
  `pixel_y` double NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `source` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `map_features`
--

CREATE TABLE `map_features` (
  `id` bigint(20) NOT NULL,
  `feature_type` varchar(20) NOT NULL COMMENT 'road | pedestrian_zone | parking | gate | other',
  `name` varchar(150) DEFAULT NULL,
  `geom` geometry NOT NULL,
  `style_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`style_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `places`
--

CREATE TABLE `places` (
  `id` bigint(20) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `category_id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `aliases` text DEFAULT NULL COMMENT 'Từ khóa không dấu để tìm kiếm',
  `description` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `geom` point NOT NULL,
  `status` varchar(15) NOT NULL DEFAULT 'active' COMMENT 'active | maintenance | closed',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `place_categories`
--

CREATE TABLE `place_categories` (
  `id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `color` varchar(30) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `place_entrances`
--

CREATE TABLE `place_entrances` (
  `id` bigint(20) NOT NULL,
  `place_id` bigint(20) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `type` varchar(15) NOT NULL DEFAULT 'main' COMMENT 'main | side | gate | vehicle_in | vehicle_out',
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `geom` point NOT NULL,
  `node_id` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `road_edges`
--

CREATE TABLE `road_edges` (
  `id` bigint(20) NOT NULL,
  `from_node` bigint(20) NOT NULL,
  `to_node` bigint(20) NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `road_type` varchar(20) NOT NULL DEFAULT 'footway' COMMENT 'footway | service | road | steps | crossing',
  `length_m` decimal(8,2) NOT NULL,
  `cost_factor` decimal(4,2) NOT NULL DEFAULT 1.00,
  `is_bidirectional` tinyint(1) NOT NULL DEFAULT 1,
  `pedestrian_only` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `geom` linestring NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `road_nodes`
--

CREATE TABLE `road_nodes` (
  `id` bigint(20) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `geom` point NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `rooms`
--

CREATE TABLE `rooms` (
  `id` bigint(20) NOT NULL,
  `floor_id` bigint(20) NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `room_type` varchar(15) NOT NULL COMMENT 'classroom | lab | office | support | stairs | elevator | wc | corridor | other',
  `svg_element_id` varchar(60) DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL,
  `department` varchar(150) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(15) NOT NULL DEFAULT 'active' COMMENT 'active | maintenance | closed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `route_logs`
--

CREATE TABLE `route_logs` (
  `id` bigint(20) NOT NULL,
  `origin_type` varchar(10) NOT NULL COMMENT 'gps | place | map_click',
  `origin_place_id` bigint(20) DEFAULT NULL,
  `origin_lat` double DEFAULT NULL,
  `origin_lng` double DEFAULT NULL,
  `dest_place_id` bigint(20) DEFAULT NULL,
  `dest_lat` double DEFAULT NULL,
  `dest_lng` double DEFAULT NULL,
  `distance_m` decimal(10,2) DEFAULT NULL,
  `duration_s` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `search_logs`
--

CREATE TABLE `search_logs` (
  `id` bigint(20) NOT NULL,
  `keyword` varchar(200) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `selected_place_id` bigint(20) DEFAULT NULL,
  `result_count` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc đóng vai cho view `v_building_stats`
-- (See below for the actual view)
--
CREATE TABLE `v_building_stats` (
`place_id` bigint(20)
,`code` varchar(10)
,`building_name` varchar(200)
,`total_floors` bigint(21)
,`total_rooms` bigint(21)
);

-- --------------------------------------------------------

--
-- Cấu trúc cho view `v_building_stats`
--
DROP TABLE IF EXISTS `v_building_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_building_stats`  AS SELECT `b`.`place_id` AS `place_id`, `b`.`code` AS `code`, `p`.`name` AS `building_name`, count(distinct `f`.`id`) AS `total_floors`, count(distinct `r`.`id`) AS `total_rooms` FROM (((`buildings` `b` join `places` `p` on(`b`.`place_id` = `p`.`id`)) left join `floors` `f` on(`b`.`place_id` = `f`.`building_id`)) left join `rooms` `r` on(`f`.`id` = `r`.`floor_id`)) GROUP BY `b`.`place_id`, `b`.`code`, `p`.`name` ;

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Chỉ mục cho bảng `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_audit_admin` (`admin_id`);

--
-- Chỉ mục cho bảng `buildings`
--
ALTER TABLE `buildings`
  ADD PRIMARY KEY (`place_id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Chỉ mục cho bảng `floors`
--
ALTER TABLE `floors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_building_level` (`building_id`,`level`);

--
-- Chỉ mục cho bảng `georef_anchors`
--
ALTER TABLE `georef_anchors`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `map_features`
--
ALTER TABLE `map_features`
  ADD PRIMARY KEY (`id`),
  ADD SPATIAL KEY `geom` (`geom`);

--
-- Chỉ mục cho bảng `places`
--
ALTER TABLE `places`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD SPATIAL KEY `geom` (`geom`),
  ADD KEY `fk_places_category` (`category_id`);

--
-- Chỉ mục cho bảng `place_categories`
--
ALTER TABLE `place_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `fk_category_parent` (`parent_id`);

--
-- Chỉ mục cho bảng `place_entrances`
--
ALTER TABLE `place_entrances`
  ADD PRIMARY KEY (`id`),
  ADD SPATIAL KEY `geom` (`geom`),
  ADD KEY `fk_entrance_place` (`place_id`),
  ADD KEY `fk_entrance_node` (`node_id`);

--
-- Chỉ mục cho bảng `road_edges`
--
ALTER TABLE `road_edges`
  ADD PRIMARY KEY (`id`),
  ADD SPATIAL KEY `geom` (`geom`),
  ADD KEY `fk_edge_from_node` (`from_node`),
  ADD KEY `fk_edge_to_node` (`to_node`);

--
-- Chỉ mục cho bảng `road_nodes`
--
ALTER TABLE `road_nodes`
  ADD PRIMARY KEY (`id`),
  ADD SPATIAL KEY `geom` (`geom`);

--
-- Chỉ mục cho bảng `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_floor_room_code` (`floor_id`,`code`),
  ADD UNIQUE KEY `uq_floor_svg_element` (`floor_id`,`svg_element_id`);

--
-- Chỉ mục cho bảng `route_logs`
--
ALTER TABLE `route_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_route_orig_place` (`origin_place_id`),
  ADD KEY `fk_route_dest_place` (`dest_place_id`);

--
-- Chỉ mục cho bảng `search_logs`
--
ALTER TABLE `search_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_search_created_at` (`created_at`),
  ADD KEY `fk_search_cat` (`category_id`),
  ADD KEY `fk_search_place` (`selected_place_id`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `admins`
--
ALTER TABLE `admins`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT cho bảng `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `floors`
--
ALTER TABLE `floors`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `georef_anchors`
--
ALTER TABLE `georef_anchors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `map_features`
--
ALTER TABLE `map_features`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `places`
--
ALTER TABLE `places`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `place_categories`
--
ALTER TABLE `place_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `place_entrances`
--
ALTER TABLE `place_entrances`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `road_edges`
--
ALTER TABLE `road_edges`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `road_nodes`
--
ALTER TABLE `road_nodes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `route_logs`
--
ALTER TABLE `route_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `search_logs`
--
ALTER TABLE `search_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Các ràng buộc cho các bảng đã đổ
--

--
-- Các ràng buộc cho bảng `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL;

--
-- Các ràng buộc cho bảng `buildings`
--
ALTER TABLE `buildings`
  ADD CONSTRAINT `fk_buildings_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `floors`
--
ALTER TABLE `floors`
  ADD CONSTRAINT `fk_floors_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`place_id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `places`
--
ALTER TABLE `places`
  ADD CONSTRAINT `fk_places_category` FOREIGN KEY (`category_id`) REFERENCES `place_categories` (`id`);

--
-- Các ràng buộc cho bảng `place_categories`
--
ALTER TABLE `place_categories`
  ADD CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `place_categories` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `place_entrances`
--
ALTER TABLE `place_entrances`
  ADD CONSTRAINT `fk_entrance_node` FOREIGN KEY (`node_id`) REFERENCES `road_nodes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_entrance_place` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `road_edges`
--
ALTER TABLE `road_edges`
  ADD CONSTRAINT `fk_edge_from_node` FOREIGN KEY (`from_node`) REFERENCES `road_nodes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_edge_to_node` FOREIGN KEY (`to_node`) REFERENCES `road_nodes` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `rooms`
--
ALTER TABLE `rooms`
  ADD CONSTRAINT `fk_rooms_floor` FOREIGN KEY (`floor_id`) REFERENCES `floors` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `route_logs`
--
ALTER TABLE `route_logs`
  ADD CONSTRAINT `fk_route_dest_place` FOREIGN KEY (`dest_place_id`) REFERENCES `places` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_route_orig_place` FOREIGN KEY (`origin_place_id`) REFERENCES `places` (`id`) ON DELETE SET NULL;

--
-- Các ràng buộc cho bảng `search_logs`
--
ALTER TABLE `search_logs`
  ADD CONSTRAINT `fk_search_cat` FOREIGN KEY (`category_id`) REFERENCES `place_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_search_place` FOREIGN KEY (`selected_place_id`) REFERENCES `places` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
