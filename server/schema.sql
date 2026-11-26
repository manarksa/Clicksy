-- Clicksy tables. Safe to run again: CREATE TABLE IF NOT EXISTS never drops or empties anything.
-- The server runs this automatically on start. Package rows live in seed-packages.sql
-- (npm run db:seed), so they are not re-inserted on every start.
-- Order matters: a table is created after every table it references.


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

-- Photography packages. Pricing is per hour with a minimum number of hours.
-- The package name is the same in Arabic and English; descriptions are per language.
CREATE TABLE IF NOT EXISTS packages (
  package_id     VARCHAR(40)      NOT NULL PRIMARY KEY,       -- e.g. 'essential' (used in URLs and bookings)
  name           VARCHAR(80)      NOT NULL,
  description_en VARCHAR(255)     NOT NULL,
  description_ar VARCHAR(255)     NOT NULL,
  price          INT UNSIGNED     NOT NULL COMMENT 'SAR per hour',
  duration       TINYINT UNSIGNED NOT NULL COMMENT 'minimum hours',
  is_popular     TINYINT(1)       NOT NULL DEFAULT 0,          -- "Most booked" badge
  is_active      TINYINT(1)       NOT NULL DEFAULT 1           -- 0 = hidden and not bookable (never delete a booked package)
);

-- What each package includes (one package → many features), shown in sort_order.
CREATE TABLE IF NOT EXISTS package_features (
  feature_id      INT AUTO_INCREMENT PRIMARY KEY,
  package_id      VARCHAR(40)      NOT NULL,
  feature_name_en VARCHAR(160)     NOT NULL,
  feature_name_ar VARCHAR(160)     NOT NULL,
  sort_order      TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_package_feature_order (package_id, sort_order),
  CONSTRAINT fk_features_package FOREIGN KEY (package_id) REFERENCES packages(package_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- A booking keeps the price agreed at booking time (total_price) and, for now, a copy of the
-- package name (package_name) so older app versions keep working; the package itself is the FK.
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_package FOREIGN KEY (package_id) REFERENCES packages(package_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);
