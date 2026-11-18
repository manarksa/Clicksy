-- Clicksy tables. Safe to run again: CREATE TABLE IF NOT EXISTS never drops or empties anything.
-- The server runs this automatically on start (as clicksy_user, inside the clicksy database).
-- To run by hand in MySQL Workbench: first run setup-root.sql once, then select the clicksy schema and run this.


-- Everyone who can sign in. role = 'admin' is the studio owner.
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(190) NOT NULL UNIQUE,
  phone          VARCHAR(40)  NOT NULL DEFAULT '',
  password_hash  VARCHAR(100) NOT NULL,           -- bcrypt hash, never the real password
  role           ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  email_verified TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6-digit codes sent by email at sign-in / sign-up.
CREATE TABLE IF NOT EXISTS email_codes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT        NOT NULL,
  code_hash  CHAR(64)   NOT NULL,                 -- sha256 of the code
  expires_at DATETIME   NOT NULL,
  attempts   INT        NOT NULL DEFAULT 0,
  used       TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Signed-in browsers. The cookie holds a random token; only its hash is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id    INT      NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT          NOT NULL,
  package_id        VARCHAR(40)  NOT NULL,
  package_name      VARCHAR(80)  NOT NULL,
  event_type_id     VARCHAR(40)  NOT NULL,
  custom_event_name VARCHAR(80)  NULL,
  hours             INT          NOT NULL,
  event_date        DATE         NOT NULL,
  location          VARCHAR(200) NOT NULL,
  notes             TEXT         NULL,
  total_price       INT          NOT NULL,
  status            ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
