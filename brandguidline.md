Here's a comprehensive PRD for the Sri Lanka Bus Tap-and-Pay system, along with an Antigravity prompt and a page-by-page breakdown.---

## Product Requirements Document
### BusTap — Sri Lanka Smart Bus Ticketing System

---

### 1. Overview

**Product Name:** BusTap
**Stack:** Next.js · Supabase · Stripe · ESP32 (RFID + GPS + OLED) · Sentry · PostHog

BusTap is a contactless bus ticketing platform for Sri Lankan local buses. Passengers register once, link their RFID card, and tap on/off at each journey. The system calculates the fare using real-time GPS distance, deducts from their wallet, and delivers a digital ticket. Operators and admins monitor fleets and accounts through a dashboard.

---

### 2. User Roles

| Role | Description |
|---|---|
| Passenger | Registers, recharges wallet, views tickets and trip history |
| Bus Operator | Manages the ESP32 unit, views trip logs |
| Admin | Manages all passengers, buses, routes, pricing config |

---

### 3. Pages & What To Build On Each

---

#### Page 1 — `/register` — Passenger Registration

**Purpose:** Onboard a new passenger and link their RFID card to their account.

**Fields to collect:**
- Full name
- NIC (National Identity Card number — validated as 9 digits + V/X or 12 digits)
- Phone number (Sri Lanka format: +94)
- Gender (Male / Female / Prefer not to say)
- Permanent resident address
- RFID card UID (entered manually or captured via a tap-to-enroll flow where the admin taps the card on a registration unit)

**What to build:**
- Multi-step form (Step 1: personal details → Step 2: address → Step 3: RFID link)
- NIC format validation (old: 9 digits + V/X; new: 12 digits)
- On submit, create a row in `passengers` table and a row in `accounts` (initial balance: 0)
- Show success screen with account number and QR code linking to the passenger portal
- Supabase auth: create user with phone/email for portal login

---

#### Page 2 — `/dashboard` — Passenger Portal Home

**Purpose:** Central hub for the passenger after login.

**What to build:**
- Wallet balance card (large, prominent — e.g. "LKR 450.00")
- Quick recharge button
- Last 3 trips summary (route, date, fare)
- "View all tickets" link
- Account status badge (Active / Suspended)
- Notification bell (for ticket arrivals, low balance alerts)

---

#### Page 3 — `/recharge` — Wallet Top-Up via Stripe

**Purpose:** Allow passengers to add funds to their transit wallet.

**What to build:**
- Preset amounts (LKR 100 / 250 / 500 / 1000) + custom amount input
- Stripe Checkout Session creation via a Next.js API route (`/api/payment/create-session`)
- On Stripe webhook success (`checkout.session.completed`), update `accounts.balance` in Supabase
- Payment history table below the recharge form
- Show current balance before and after
- Handle failed/cancelled payments gracefully

**Stripe integration notes:**
- Currency: `lkr`
- Use Stripe webhook endpoint verification with signing secret
- Store `stripe_payment_intent_id` in a `transactions` table

---

#### Page 4 — `/tickets` — My Tickets

**Purpose:** Show all bus tickets delivered post-journey.

**What to build:**
- List of tickets sorted by date descending
- Each ticket card shows: date, bus number, board stop (GPS coord → reverse geocoded to a readable name), alight stop, distance (km), fare (LKR), trip duration
- Tap a ticket to expand it — show a full digital ticket with a QR code (encodes trip ID)
- Filter by date range
- "Download as PDF" option (use `jsPDF` or similar)
- Real-time ticket delivery: subscribe to Supabase Realtime on the `tickets` table — new ticket pops up instantly after passenger taps out of a bus

---

#### Page 5 — `/track` — Live Bus Tracker

**Purpose:** Let passengers see where their bus is in real time.

**What to build:**
- Map view using Leaflet.js or Mapbox with Sri Lanka centered
- Show all active buses as moving markers
- Each bus marker shows: bus number, route name, last GPS update time
- Passenger can filter by route
- Bus location is pushed by the ESP32 every 5–10 seconds via a Supabase edge function or direct REST insert to `bus_locations` table
- Realtime subscription on `bus_locations` updates markers without page refresh
- ETA estimation (rough: distance ÷ average speed)

---

#### Page 6 — `/account` — Profile & Settings

**Purpose:** View and edit personal details, manage security.

**What to build:**
- View/edit name, phone, address
- NIC shown read-only (cannot be changed post-registration)
- RFID card UID shown (with option to request a card replacement — marks a flag in DB)
- Change phone number (triggers OTP re-verification via Supabase Auth)
- Low-balance notification threshold setting
- Account deactivation request

---

#### Page 7 — `/admin` — Admin Dashboard

**Purpose:** Full operational control for system administrators.

**What to build:**
- KPI cards: total registered passengers, active buses, today's total transactions, revenue (LKR)
- Passenger management table: search by NIC/name, view account, suspend/activate
- Bus management: register a new bus (assign bus ID, route, link to an ESP32 device ID)
- Pricing config: set fare per km (can vary by route or time of day)
- Trip log: all trips with filters by bus/date/passenger
- Manual balance adjustment (for disputes/corrections) with audit log
- Sentry error feed embedded (via Sentry's API or link to Sentry dashboard)
- PostHog funnel metrics: registration completions, recharge conversion rates

---

#### Page 8 — `/api/tap` — ESP32 Tap Endpoint (Backend API)

**Purpose:** Receives tap events from the bus hardware and processes them.

**What to build (Next.js API route):**

On **tap-in:**
1. Receive `{ rfid_uid, bus_id, gps_lat, gps_lng, timestamp }`
2. Look up passenger by `rfid_uid` in Supabase
3. Check `accounts.balance >= minimum_fare` (configurable, e.g. LKR 15)
4. If sufficient: create a `trips` row with `status: 'in_progress'`, log board location
5. Return `{ status: 'ok', passenger_name, balance }` → ESP32 displays this on OLED
6. If insufficient: return `{ status: 'low_balance', balance }` → OLED shows "Top up required"

On **tap-out:**
1. Receive `{ rfid_uid, bus_id, gps_lat, gps_lng, timestamp }`
2. Find the open `trips` row for this passenger
3. Calculate Haversine distance between board and alight GPS coords
4. Apply fare formula: `fare = distance_km × fare_per_km` (round up to nearest LKR 5)
5. Deduct fare from `accounts.balance`
6. Update `trips` row: `status: 'completed'`, alight location, fare, distance
7. Insert into `tickets` table → triggers Realtime push to passenger's portal
8. Return `{ status: 'ok', fare, new_balance }` → OLED shows fare + balance

---

### 4. Database Schema (Supabase)

| Table | Key columns |
|---|---|
| `passengers` | id, name, nic, phone, gender, address, rfid_uid, created_at |
| `accounts` | id, passenger_id, balance, status |
| `transactions` | id, passenger_id, type (credit/debit), amount, stripe_payment_intent_id, created_at |
| `buses` | id, bus_number, route_name, esp32_device_id, status |
| `bus_locations` | id, bus_id, lat, lng, updated_at |
| `trips` | id, passenger_id, bus_id, board_lat, board_lng, board_time, alight_lat, alight_lng, alight_time, distance_km, fare, status |
| `tickets` | id, trip_id, passenger_id, issued_at, qr_code_data |
| `pricing_config` | id, route_id (nullable), fare_per_km, effective_from |

---

### 5. Monitoring

- **Sentry:** Instrument all Next.js API routes and frontend pages. Alert on tap endpoint errors (failed balance deductions are critical). Track ESP32 communication failures.
- **PostHog:** Track registration funnel drop-off, recharge frequency, average wallet balance trends, MAU, DAU. Set up a cohort for passengers with <LKR 50 balance for proactive marketing.

---

### 6. Antigravity Prompt

Use this prompt to build the application with Antigravity (or any AI coding assistant such as Cursor/Windsurf):

---

> **Build a full-stack tap-and-pay bus ticketing web application called BusTap for Sri Lankan local buses using the following stack: Next.js 14 (App Router), Supabase (PostgreSQL + Auth + Realtime), Stripe, Sentry, and PostHog.**
>
> **Database (Supabase):** Create migrations for these tables: `passengers` (id uuid PK, name text, nic text unique, phone text, gender text, address text, rfid_uid text unique, created_at timestamptz), `accounts` (id uuid PK, passenger_id uuid FK → passengers, balance numeric default 0, status text default 'active'), `transactions` (id, passenger_id FK, type text, amount numeric, stripe_payment_intent_id text, created_at), `buses` (id, bus_number text, route_name text, esp32_device_id text unique, status text), `bus_locations` (id, bus_id FK, lat numeric, lng numeric, updated_at), `trips` (id, passenger_id FK, bus_id FK, board_lat, board_lng, board_time timestamptz, alight_lat, alight_lng, alight_time, distance_km numeric, fare numeric, status text default 'in_progress'), `tickets` (id, trip_id FK unique, passenger_id FK, issued_at timestamptz, qr_code_data text), `pricing_config` (id, route_id uuid nullable, fare_per_km numeric, effective_from date). Enable Row Level Security: passengers can only read their own data.
>
> **Pages to build:**
> 1. `/register` — Multi-step form (personal info → address → RFID UID entry). Validate NIC (9 digits + V/X or 12 digits). On submit, create a Supabase Auth user and insert into `passengers` and `accounts`.
> 2. `/dashboard` (authenticated) — Show wallet balance, last 3 trips, quick recharge button. Subscribe to Supabase Realtime on `accounts` for live balance updates.
> 3. `/recharge` (authenticated) — Preset LKR amounts (100/250/500/1000) + custom. Create Stripe Checkout Session via `/api/payment/create-session`. On webhook `checkout.session.completed`, increment `accounts.balance`. Show transaction history.
> 4. `/tickets` (authenticated) — List all tickets. Each shows date, bus, distance, fare. Realtime subscription on `tickets` table for instant delivery after tap-out. Each ticket expandable with QR code (encode trip id).
> 5. `/track` — Leaflet.js map showing all active buses as live markers. Subscribe to Supabase Realtime on `bus_locations`. Markers update without refresh.
> 6. `/account` (authenticated) — View/edit passenger profile. Show RFID UID as read-only.
> 7. `/admin` (admin-only) — Passenger management table, bus management, pricing config editor, trip log, KPI summary cards.
>
> **API routes (Next.js route handlers):**
> - `POST /api/tap` — Accepts `{ rfid_uid, bus_id, gps_lat, gps_lng, timestamp, event_type: 'in' | 'out' }`. For tap-in: look up passenger by rfid_uid, check balance >= minimum fare (read from pricing_config), create trip row, return `{ status, passenger_name, balance }`. For tap-out: find open trip, calculate Haversine distance, calculate fare = distance × fare_per_km rounded up to nearest 5 LKR, deduct from account, complete trip row, insert ticket row, return `{ status, fare, new_balance }`. Protect with an ESP32 device API key in header.
> - `POST /api/payment/create-session` — Creates Stripe Checkout session in LKR currency.
> - `POST /api/payment/webhook` — Handles `checkout.session.completed`, updates account balance.
> - `POST /api/bus-location` — Accepts `{ bus_id, lat, lng }` from ESP32 every 10 seconds, upserts into `bus_locations`.
>
> **Monitoring:** Instrument all API routes and page errors with Sentry (`@sentry/nextjs`). Add PostHog provider to the root layout for analytics tracking (page views, recharge events, registration completions).
>
> **Environment variables needed:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `ESP32_API_KEY` (for securing the /api/tap endpoint).
>
> **ESP32 firmware notes (document in README):** The MCU should POST to `/api/tap` on each RFID scan. GPS coordinates come from the NEO-6M/7M module via UART. Bus location should POST to `/api/bus-location` every 10 seconds. The OLED (SSD1306 via I2C) displays the response: passenger name + balance on tap-in, or fare charged + new balance on tap-out.

---

### 7. Key Technical Decisions

- **Fare formula:** Haversine distance (as the crow flies) × fare_per_km, rounded up to nearest LKR 5. This is a starting point — a real deployment should calibrate against actual route distances.
- **Minimum balance enforcement** happens at tap-in, not tap-out, to prevent zero-balance exits.
- **Realtime ticket delivery** uses Supabase Realtime channel subscriptions filtered by `passenger_id` — no polling needed.
- **ESP32 authentication** uses a shared API key per device stored in NVS (non-volatile storage), sent as a request header on every POST.
- **Offline resilience:** If the bus loses WiFi, the ESP32 should queue tap events locally (SPIFFS or SD card) and flush them when connectivity resumes — document this in firmware spec.