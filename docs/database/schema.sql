-- SupportPilot database schema (MySQL 8 / TiDB)
-- Exported from the live database with SHOW CREATE TABLE. Tables are listed in
-- dependency order, so the file can be run top to bottom on an empty database.
-- The server also creates any missing table or column at startup (initMySQLSchema).

SET FOREIGN_KEY_CHECKS = 0;

-- roles
CREATE TABLE IF NOT EXISTS `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_id`) ,
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- companies
CREATE TABLE IF NOT EXISTS `companies` (
  `company_id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(150) NOT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `business_email` varchar(150) NOT NULL,
  `company_phone` varchar(20) DEFAULT NULL,
  `website_url` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('Pending','Active','Suspended','Inactive','Rejected') DEFAULT 'Pending',
  `registration_date` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`company_id`) ,
  UNIQUE KEY `business_email` (`business_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- users
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `company_id` int DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `profile_picture_url` varchar(255) DEFAULT NULL,
  `online_status` enum('Online','Offline','Away') DEFAULT 'Offline',
  `account_status` enum('Active','Inactive','Suspended') DEFAULT 'Active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `google_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`) ,
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_role` (`role_id`),
  KEY `fk_users_company` (`company_id`),
  UNIQUE KEY `idx_users_google_id` (`google_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- company_admins
CREATE TABLE IF NOT EXISTS `company_admins` (
  `admin_id` int NOT NULL,
  `company_id` int NOT NULL,
  `appointed_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_id`) ,
  UNIQUE KEY `company_id` (`company_id`),
  CONSTRAINT `fk_company_admin_user` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_company_admin_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- password_reset_tokens
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `reset_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reset_id`) ,
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `fk_reset_user` (`user_id`),
  CONSTRAINT `fk_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- tickets
CREATE TABLE IF NOT EXISTS `tickets` (
  `ticket_id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `requester_name` varchar(150) DEFAULT NULL,
  `requester_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('Low','Medium','High','Urgent') DEFAULT 'Medium',
  `assigned_agent_id` int DEFAULT NULL,
  `status` enum('Open','Assigned','In Progress','Pending','Resolved','Closed') DEFAULT 'Open',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`ticket_id`) ,
  KEY `fk_tickets_company` (`company_id`),
  KEY `fk_tickets_customer` (`customer_id`),
  KEY `idx_tickets_customer` (`company_id`,`customer_id`,`created_at`),
  CONSTRAINT `fk_tickets_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- ticket_replies
CREATE TABLE IF NOT EXISTS `ticket_replies` (
  `reply_id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `author_id` int DEFAULT NULL,
  `author_role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT '0',
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reply_id`) ,
  KEY `idx_ticket_replies_ticket` (`company_id`,`ticket_id`,`created_at`,`reply_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- faqs
CREATE TABLE IF NOT EXISTS `faqs` (
  `faq_id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `question` varchar(500) NOT NULL,
  `answer` text NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `faq_status` enum('Draft','Published','Archived') DEFAULT 'Draft',
  `view_count` int DEFAULT '0',
  `helpful_count` int DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`faq_id`) ,
  KEY `fk_faq_company` (`company_id`),
  KEY `fk_faq_created_by` (`created_by_user_id`),
  CONSTRAINT `fk_faq_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_faq_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- company_ai_settings
CREATE TABLE IF NOT EXISTS `company_ai_settings` (
  `settings_id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `assistant_name` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SupportPilot Assistant',
  `tone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'professional',
  `greeting` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `answer_from_faqs_only` tinyint(1) NOT NULL DEFAULT '1',
  `confidence_threshold` tinyint unsigned NOT NULL DEFAULT '70',
  `escalate_after_failures` tinyint unsigned NOT NULL DEFAULT '2',
  `fallback_message` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `custom_instructions` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`settings_id`) ,
  UNIQUE KEY `uq_company_ai_settings_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- platform_settings
CREATE TABLE IF NOT EXISTS `platform_settings` (
  `settings_id` tinyint NOT NULL,
  `settings_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`settings_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- chat_sessions
CREATE TABLE IF NOT EXISTS `chat_sessions` (
  `session_id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `status` enum('Active','Resolved','Escalated') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `failed_answers` tinyint unsigned NOT NULL DEFAULT '0',
  `ticket_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`) ,
  KEY `idx_chat_sessions_customer` (`company_id`,`customer_id`,`status`),
  KEY `idx_chat_sessions_company_status` (`company_id`,`status`),
  KEY `fk_chat_sessions_customer` (`customer_id`),
  KEY `fk_chat_sessions_ticket` (`ticket_id`),
  CONSTRAINT `fk_chat_sessions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_sessions_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_sessions_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- chat_messages
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `message_id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `sender` enum('customer','assistant','system') COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidence` tinyint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`) ,
  KEY `idx_chat_messages_session` (`session_id`,`message_id`),
  CONSTRAINT `fk_chat_messages_session` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`session_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Roles the application relies on
INSERT INTO roles (role_id, role_name) VALUES
  (1, 'Platform Admin'),
  (2, 'Company Admin'),
  (3, 'Support Agent'),
  (30001, 'Customer')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);
