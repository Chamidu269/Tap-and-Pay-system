-- ============================================================
-- CLEANUP EXISTING SCHEMA (Avoids "relation already exists" errors)
-- ============================================================
DROP VIEW IF EXISTS bus_owner_requests CASCADE;
DROP TABLE IF EXISTS rfid_change_log CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS pricing_config CASCADE;
DROP TABLE IF EXISTS bus_locations CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS bus_owners CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS passengers CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS get_admin_kpis() CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS account_status CASCADE;
DROP TYPE IF EXISTS trip_status CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS bus_status CASCADE;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'bus_owner', 'passenger');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'refund');
CREATE TYPE bus_status AS ENUM ('active', 'inactive', 'maintenance');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'passenger',
  status        account_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMIN ACCOUNTS (separate credential store)
-- ============================================================
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email         TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PASSENGERS
-- ============================================================
CREATE TABLE passengers (
  id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  nic           TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL,
  gender        TEXT CHECK (gender IN ('male','female','other')),
  address       TEXT NOT NULL,
  rfid_uid      TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PASSENGER WALLET ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id  UUID NOT NULL UNIQUE REFERENCES passengers(id) ON DELETE CASCADE,
  balance       NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  status        account_status NOT NULL DEFAULT 'active',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUS OWNERS
-- ============================================================
CREATE TABLE bus_owners (
  id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  nic           TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL,
  address       TEXT NOT NULL,
  email         TEXT NOT NULL,
  status        account_status NOT NULL DEFAULT 'pending',
  approved_by   UUID REFERENCES admins(id),
  approved_at   TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUSES (one owner can have many)
-- ============================================================
CREATE TABLE buses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES bus_owners(id) ON DELETE CASCADE,
  bus_number      TEXT NOT NULL UNIQUE,
  route_name      TEXT,
  esp32_device_id TEXT UNIQUE,
  status          bus_status NOT NULL DEFAULT 'active',
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUS LIVE LOCATIONS
-- ============================================================
CREATE TABLE bus_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id      UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  lat         NUMERIC(10,7) NOT NULL,
  lng         NUMERIC(10,7) NOT NULL,
  speed_kmh   NUMERIC(5,1),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX bus_locations_bus_id_idx ON bus_locations(bus_id);

-- ============================================================
-- PRICING CONFIG
-- ============================================================
CREATE TABLE pricing_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        UUID REFERENCES buses(id),
  fare_per_km     NUMERIC(6,2) NOT NULL DEFAULT 10.00,
  minimum_fare    NUMERIC(6,2) NOT NULL DEFAULT 15.00,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by      UUID REFERENCES admins(id)
);
INSERT INTO pricing_config (fare_per_km, minimum_fare) VALUES (10.00, 15.00);

-- ============================================================
-- TRIPS
-- ============================================================
CREATE TABLE trips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id  UUID NOT NULL REFERENCES passengers(id),
  bus_id        UUID NOT NULL REFERENCES buses(id),
  board_lat     NUMERIC(10,7),
  board_lng     NUMERIC(10,7),
  board_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alight_lat    NUMERIC(10,7),
  alight_lng    NUMERIC(10,7),
  alight_time   TIMESTAMPTZ,
  distance_km   NUMERIC(8,3),
  fare          NUMERIC(8,2),
  status        trip_status NOT NULL DEFAULT 'in_progress',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TICKETS (issued after tap-out)
-- ============================================================
CREATE TABLE tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL UNIQUE REFERENCES trips(id),
  passenger_id  UUID NOT NULL REFERENCES passengers(id),
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qr_code_data  TEXT NOT NULL
);

-- ============================================================
-- TRANSACTIONS (wallet credits and debits)
-- ============================================================
CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id          UUID NOT NULL REFERENCES passengers(id),
  type                  transaction_type NOT NULL,
  amount                NUMERIC(10,2) NOT NULL,
  description           TEXT,
  stripe_payment_intent TEXT,
  trip_id               UUID REFERENCES trips(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RFID CHANGE LOG (admin-managed)
-- ============================================================
CREATE TABLE rfid_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id    UUID NOT NULL REFERENCES passengers(id),
  old_rfid_uid    TEXT,
  new_rfid_uid    TEXT NOT NULL,
  changed_by      UUID REFERENCES admins(id),
  reason          TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUS OWNER REGISTRATION REQUESTS (for admin panel)
-- VIEW — joins bus_owners with their buses
-- ============================================================
CREATE VIEW bus_owner_requests AS
  SELECT
    bo.id,
    bo.full_name,
    bo.nic,
    bo.phone,
    bo.email,
    bo.address,
    bo.status,
    bo.created_at,
    bo.rejection_reason,
    COUNT(b.id) AS bus_count,
    ARRAY_AGG(b.bus_number) FILTER (WHERE b.id IS NOT NULL) AS bus_numbers
  FROM bus_owners bo
  LEFT JOIN buses b ON b.owner_id = bo.id
  GROUP BY bo.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_owners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;

-- Passengers see only their own data
CREATE POLICY "passenger_self" ON passengers FOR ALL USING (auth.uid() = id);
CREATE POLICY "account_self"   ON accounts   FOR ALL USING (auth.uid() = passenger_id);
CREATE POLICY "trips_self"     ON trips      FOR ALL USING (auth.uid() = passenger_id);
CREATE POLICY "tickets_self"   ON tickets    FOR ALL USING (auth.uid() = passenger_id);
CREATE POLICY "tx_self"        ON transactions FOR ALL USING (auth.uid() = passenger_id);

-- Bus owners see their own profile and their buses
CREATE POLICY "owner_self"     ON bus_owners FOR ALL USING (auth.uid() = id);
CREATE POLICY "buses_owner"    ON buses      FOR ALL USING (
  auth.uid() IN (SELECT id FROM bus_owners WHERE id = owner_id)
);

-- Profiles visible to owner
CREATE POLICY "profile_self"   ON profiles FOR ALL USING (auth.uid() = id);

-- bus_locations is public-readable (for map), writable by service role only
CREATE POLICY "locations_read" ON bus_locations FOR SELECT USING (true);

-- ============================================================
-- HELPER FUNCTION: admin KPI counts
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_kpis()
RETURNS TABLE(
  total_passengers BIGINT,
  total_bus_owners BIGINT,
  total_buses      BIGINT,
  total_transactions BIGINT,
  total_revenue    NUMERIC
) LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT
    (SELECT COUNT(*) FROM passengers),
    (SELECT COUNT(*) FROM bus_owners WHERE status = 'active'),
    (SELECT COUNT(*) FROM buses WHERE status = 'active'),
    (SELECT COUNT(*) FROM transactions),
    (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type = 'credit');
$$;
