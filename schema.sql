-- ============================================================
-- VaultShare Enterprise File Management System
-- MySQL Schema — Fixed for Ubuntu 24 / MySQL 8.0
--
-- Changes from original:
--   files.s3_key      VARCHAR(1000) → VARCHAR(700)   fixes key too long error
--   files.original_name VARCHAR(500) → VARCHAR(255)  fixes key too long error
--   shared_folders.s3_prefix VARCHAR(500) → VARCHAR(255)
--   audit_log.resource_name VARCHAR(500) → VARCHAR(255)
--   user_sessions.user_agent VARCHAR(500) → VARCHAR(255)
-- ============================================================

CREATE DATABASE IF NOT EXISTS vaultshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vaultshare;

-- ── Companies ──────────────────────────────────────────────────
CREATE TABLE companies (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  location      VARCHAR(255),
  industry      VARCHAR(100),
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companies_name (name)
) ENGINE=InnoDB;

-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE users (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  mobile          VARCHAR(30),
  password_hash   VARCHAR(255) NOT NULL,
  company_id      VARCHAR(36),
  role            ENUM('user','admin') NOT NULL DEFAULT 'user',
  status          ENUM('pending','active','suspended','rejected') NOT NULL DEFAULT 'pending',
  totp_secret     VARCHAR(255),
  totp_enabled    TINYINT(1)   NOT NULL DEFAULT 0,
  totp_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  email_verify_token VARCHAR(255),
  reset_token     VARCHAR(255),
  reset_token_expires DATETIME,
  last_login_at   DATETIME,
  last_login_ip   VARCHAR(45),
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until    DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_users_email (email),
  INDEX idx_users_status (status),
  INDEX idx_users_company (company_id)
) ENGINE=InnoDB;

-- ── Registration Requests ──────────────────────────────────────
CREATE TABLE registration_requests (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  mobile          VARCHAR(30),
  company_name    VARCHAR(255) NOT NULL,
  company_location VARCHAR(255),
  industry        VARCHAR(100),
  purpose         TEXT,
  status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by     VARCHAR(36),
  reviewed_at     DATETIME,
  rejection_reason TEXT,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reg_requests_status (status),
  INDEX idx_reg_requests_email (email)
) ENGINE=InnoDB;

-- ── Shared Folders ─────────────────────────────────────────────
CREATE TABLE shared_folders (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  folder_name     VARCHAR(100) NOT NULL UNIQUE,
  s3_prefix       VARCHAR(255) NOT NULL,          -- was VARCHAR(500)
  company_id      VARCHAR(36),
  description     TEXT,
  quota_bytes     BIGINT       NOT NULL DEFAULT 1099511627776, -- 1 TB
  used_bytes      BIGINT       NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_by      VARCHAR(36)  NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_folders_company    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_folders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_folders_name    (folder_name),
  INDEX idx_folders_company (company_id)
) ENGINE=InnoDB;

-- ── Folder Permissions ─────────────────────────────────────────
CREATE TABLE folder_permissions (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id         VARCHAR(36)  NOT NULL,
  folder_id       VARCHAR(36)  NOT NULL,
  permission      ENUM('read','write','none') NOT NULL DEFAULT 'read',
  granted_by      VARCHAR(36)  NOT NULL,
  granted_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME,
  CONSTRAINT fk_perms_user       FOREIGN KEY (user_id)   REFERENCES users(id)           ON DELETE CASCADE,
  CONSTRAINT fk_perms_folder     FOREIGN KEY (folder_id) REFERENCES shared_folders(id)  ON DELETE CASCADE,
  CONSTRAINT fk_perms_granted_by FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE KEY uk_user_folder (user_id, folder_id),
  INDEX idx_perms_user   (user_id),
  INDEX idx_perms_folder (folder_id)
) ENGINE=InnoDB;

-- ── Files ──────────────────────────────────────────────────────
-- KEY FIX: s3_key reduced to VARCHAR(700) and original_name to VARCHAR(255)
-- utf8mb4 = 4 bytes/char. 700 * 4 = 2800 bytes < 3072 byte index limit.
CREATE TABLE files (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  folder_id       VARCHAR(36)  NOT NULL,
  uploaded_by     VARCHAR(36)  NOT NULL,
  original_name   VARCHAR(255) NOT NULL,           -- was VARCHAR(500)
  s3_key          VARCHAR(700) NOT NULL UNIQUE,    -- was VARCHAR(1000) — caused the error
  mime_type       VARCHAR(100),
  size_bytes      BIGINT       NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64),
  version         INT          NOT NULL DEFAULT 1,
  is_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
  deleted_by      VARCHAR(36),
  deleted_at      DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_folder   FOREIGN KEY (folder_id)   REFERENCES shared_folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_files_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_files_folder  (folder_id),
  INDEX idx_files_uploader (uploaded_by),
  INDEX idx_files_deleted  (is_deleted)
) ENGINE=InnoDB;

-- ── User Sessions ──────────────────────────────────────────────
CREATE TABLE user_sessions (
  id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id            VARCHAR(36)  NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  ip_address         VARCHAR(45),
  user_agent         VARCHAR(255),                 -- was VARCHAR(500)
  location           VARCHAR(255),
  is_revoked         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at         DATETIME     NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user  (user_id),
  INDEX idx_sessions_token (refresh_token_hash)
) ENGINE=InnoDB;

-- ── Audit Log ──────────────────────────────────────────────────
CREATE TABLE audit_log (
  id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       VARCHAR(36),
  user_email    VARCHAR(255),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   VARCHAR(36),
  resource_name VARCHAR(255),                      -- was VARCHAR(500)
  ip_address    VARCHAR(45),
  user_agent    VARCHAR(255),
  location      VARCHAR(255),
  status        ENUM('success','failure','warning') NOT NULL DEFAULT 'success',
  details       JSON,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user    (user_id),
  INDEX idx_audit_action  (action),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_status  (status)
) ENGINE=InnoDB;

-- ── Email Notifications Log ────────────────────────────────────
CREATE TABLE email_notifications (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name  VARCHAR(255),
  template        VARCHAR(100) NOT NULL,
  subject         VARCHAR(255) NOT NULL,           -- was VARCHAR(500)
  status          ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  ses_message_id  VARCHAR(255),
  error_message   TEXT,
  sent_at         DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_email  (recipient_email),
  INDEX idx_notifications_status (status)
) ENGINE=InnoDB;

-- ── Default admin account ──────────────────────────────────────
-- Password hash below = "Admin@123456" (change immediately after first login)
INSERT INTO users (id, email, full_name, mobile, password_hash, role, status, totp_enabled, email_verified)
VALUES (
  UUID(),
  'admin@vaultshare.io',
  'System Administrator',
  NULL,
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj4oPO8u5Z4K',
  'admin',
  'active',
  0,
  1
);
