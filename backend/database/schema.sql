CREATE DATABASE IF NOT EXISTS aidetector CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aidetector;

CREATE TABLE IF NOT EXISTS users (
	id INT AUTO_INCREMENT PRIMARY KEY,
	username VARCHAR(50) NOT NULL UNIQUE,
	password VARCHAR(255) NOT NULL,
	created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME(6) NULL,
	INDEX idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
	id INT AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
	role VARCHAR(50) NOT NULL,
	INDEX idx_user_roles_user_id (user_id),
	CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS refresh_tokens (
	id INT AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
	token_hash VARCHAR(255) NOT NULL,
	expires_at DATETIME(6) NOT NULL,
	is_revoked TINYINT(1) DEFAULT 0,
	created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP,
	last_used_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP,
	ip_address VARCHAR(45),
	user_agent TEXT,
	INDEX idx_refresh_tokens_user_id (user_id),
	INDEX idx_refresh_tokens_token_hash (token_hash),
	INDEX idx_refresh_tokens_last_used (last_used_at),
	CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; 