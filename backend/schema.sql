-- Run against the selected hotel database. This file creates tables without importing any guest records.

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `firebase_uid` varchar(128) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `role` enum('customer','admin') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_firebase_uid` (`firebase_uid`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `room_types` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` varchar(30) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `capacity` tinyint(3) unsigned NOT NULL,
  `total_units` smallint(5) unsigned NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `image` varchar(2048) DEFAULT NULL,
  `bed` varchar(100) DEFAULT NULL,
  `description` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_room_types_slug` (`slug`),
  UNIQUE KEY `uq_room_types_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `reservations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `reservation_code` varchar(20) NOT NULL,
  `user_id` int(10) unsigned DEFAULT NULL,
  `room_type_id` int(10) unsigned NOT NULL,
  `guest_name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `check_in` date NOT NULL,
  `check_out` date NOT NULL,
  `guests` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `nights` smallint(5) unsigned NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('GCash','Cash','Bank Transfer','Credit/Debit Card') NOT NULL DEFAULT 'GCash',
  `status` enum('Pending','Confirmed','Cancelled') NOT NULL DEFAULT 'Pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `room_number` varchar(20) DEFAULT NULL,
  `voucher_code` varchar(40) DEFAULT NULL,
  `discount_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_reference` varchar(60) DEFAULT NULL,
  `payment_status` varchar(10) NOT NULL DEFAULT 'Unpaid',
  `extras_snapshot` JSON NULL,
  `actual_check_out` date DEFAULT NULL,
  `guest_names` JSON NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reservations_code` (`reservation_code`),
  KEY `idx_res_room_dates` (`room_type_id`,`check_in`,`check_out`),
  KEY `idx_res_status` (`status`),
  KEY `idx_res_user` (`user_id`),
  CONSTRAINT `fk_res_room_type` FOREIGN KEY (`room_type_id`) REFERENCES `room_types` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_res_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `vouchers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL,
  `discount_type` varchar(10) NOT NULL DEFAULT 'percent',
  `discount_value` decimal(10,2) NOT NULL,
  `valid_until` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `food_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_code` varchar(20) NOT NULL,
  `guest_name` varchar(120) NOT NULL,
  `email` varchar(160) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `room_number` varchar(30) DEFAULT NULL,
  `items` text NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `served_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_code` (`order_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
