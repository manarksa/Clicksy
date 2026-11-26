-- Read-only views for the shared MySQL Workbench account (clicksy_team).
-- Views are not tables: they hold no data of their own, they show safe columns of the six tables.
-- Never exposed here: users.password_hash, sessions.token_hash, email_codes.code_hash.
-- TiDB has no column-level privileges, so this is how the team reads users, sessions and codes.
-- Run as the database owner:  node server/team-views.js   (safe to run again: CREATE OR REPLACE)


-- Clients and the owner, without the password hash.
CREATE OR REPLACE SQL SECURITY DEFINER VIEW team_users AS
  SELECT id, name, email, phone, role, email_verified, created_at
  FROM users;

-- Every booking with the client's contact details and the package name.
CREATE OR REPLACE SQL SECURITY DEFINER VIEW team_bookings AS
  SELECT b.id AS booking_id, b.created_at AS booked_at, b.status, b.event_date,
         p.name AS package, b.hours, b.total_price,
         COALESCE(b.custom_event_name, b.event_type_id) AS event, b.location, b.notes,
         b.user_id, u.name AS client_name, u.email AS client_email, u.phone AS client_phone
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  JOIN packages p ON p.package_id = b.package_id;

-- Signed-in browsers (a session lasts 7 days), without the secret session token.
CREATE OR REPLACE SQL SECURITY DEFINER VIEW team_sessions AS
  SELECT s.user_id, u.name AS client_name, u.email AS client_email, u.phone AS client_phone,
         s.expires_at - INTERVAL 7 DAY AS signed_in_at, s.expires_at,
         CASE WHEN s.expires_at > NOW() THEN 'active' ELSE 'expired' END AS session_status
  FROM sessions s
  JOIN users u ON u.id = s.user_id;

-- Sign-in / sign-up email codes (valid 10 minutes), without the code itself.
CREATE OR REPLACE SQL SECURITY DEFINER VIEW team_email_codes AS
  SELECT c.id AS code_id, c.user_id, u.name AS client_name, u.email AS client_email,
         c.created_at AS sent_at, c.expires_at, c.attempts,
         CASE WHEN c.used = 1 THEN 'used' WHEN c.expires_at < NOW() THEN 'expired' ELSE 'waiting' END AS code_status
  FROM email_codes c
  JOIN users u ON u.id = c.user_id;
