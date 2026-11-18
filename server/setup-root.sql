-- ══════════════════════════════════════════════════════════════
-- Run ONCE as root (MySQL Workbench → connect as root → paste → ⚡).
-- Creates the database and lets clicksy_user use it. Deletes nothing.
-- Replace  CHANGE_ME_STRONG_PASSWORD  with your own password, then put
-- the same password in .env as DB_PASSWORD.
-- ══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS clicksy
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- If clicksy_user already exists, this line is skipped (its password stays the same).
CREATE USER IF NOT EXISTS 'clicksy_user'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

-- Only the clicksy database, only what the app needs (no DROP, no other databases).
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON clicksy.* TO 'clicksy_user'@'localhost';

FLUSH PRIVILEGES;

-- Check:  SHOW GRANTS FOR 'clicksy_user'@'localhost';
-- Forgot the password?  ALTER USER 'clicksy_user'@'localhost' IDENTIFIED BY 'new-password';
