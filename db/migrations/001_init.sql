-- 001_init: core schema for the ride-hailing app.
-- Money is integer cents + currency. Times are timestamptz (UTC).
-- Access rules: enforced in the data layer (lib/authz.ts), one check per query.

create extension if not exists pgcrypto;

create table cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'usd',
  timezone text not null default 'America/New_York',
  -- service area as a simple bounding box; swap for a PostGIS polygon later
  min_lat double precision not null,
  max_lat double precision not null,
  min_lng double precision not null,
  max_lng double precision not null,
  center_lat double precision not null,
  center_lng double precision not null,
  surge_multiplier numeric(3,2) not null default 1.00 check (surge_multiplier between 1.00 and 3.00),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  email text,
  role text not null default 'rider' check (role in ('rider','driver','admin')),
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on otp_codes (phone, created_at desc);

create table products (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  seats integer not null check (seats between 1 and 8),
  min_vehicle_year integer not null default 2012,
  base_cents integer not null,
  per_km_cents integer not null,
  per_min_cents integer not null,
  min_fare_cents integer not null,
  booking_fee_cents integer not null default 0,
  wait_grace_min integer not null default 2,
  wait_per_min_cents integer not null default 0,
  cancel_free_min integer not null default 2,
  cancel_fee_cents integer not null default 0,
  no_show_min integer not null default 5,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, code)
);
create index on products (city_id);

create table driver_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  city_id uuid not null references cities(id) on delete restrict,
  licence_no text not null,
  licence_expiry date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  review_note text,
  online boolean not null default false,
  last_lat double precision,
  last_lng double precision,
  heading double precision,
  last_seen_at timestamptz,
  dest_filter_lat double precision,
  dest_filter_lng double precision,
  dest_filter_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on driver_profiles (city_id, online, status);
create index on driver_profiles (last_lat, last_lng) where online;

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references users(id) on delete cascade,
  make text not null,
  model text not null,
  colour text not null,
  plate text not null,
  year integer not null,
  seats integer not null check (seats between 1 and 8),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vehicles (driver_id);

create table driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('licence','insurance','vehicle_photo','profile_photo')),
  filename text not null,
  mime text not null,
  bytes bytea not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index on driver_documents (driver_id);

create table saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on saved_places (user_id);

-- fallback geocoder data when no maps provider key is set
create table places (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null
);
create index on places (city_id);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('card','cash')),
  provider text not null default 'dev' check (provider in ('stripe','dev','none')),
  provider_customer_id text,
  provider_pm_id text,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payment_methods (user_id);
create unique index one_default_pm on payment_methods (user_id) where is_default;

create table trips (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete restrict,
  rider_id uuid not null references users(id) on delete restrict,
  driver_id uuid references users(id) on delete restrict,
  vehicle_id uuid references vehicles(id) on delete set null,
  product_id uuid not null references products(id) on delete restrict,
  payment_method_id uuid references payment_methods(id) on delete set null,
  status text not null default 'matching' check (status in (
    'matching','accepted','arrived','in_progress','completed',
    'cancelled_by_rider','cancelled_by_driver','no_drivers')),
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  dropoff_address text not null,
  guest_name text,
  guest_phone text,
  est_distance_m integer not null,
  est_duration_s integer not null,
  surge_multiplier numeric(3,2) not null default 1.00,
  quoted_fare_cents integer not null,
  wait_fee_cents integer not null default 0,
  final_fare_cents integer,
  tip_cents integer not null default 0,
  currency text not null default 'usd',
  pickup_eta_at timestamptz,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancel_fee_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on trips (rider_id, requested_at desc);
create index on trips (driver_id, requested_at desc);
create index on trips (status);
create index on trips (city_id, requested_at desc);
-- the hard constraints: one live trip per rider and per driver
create unique index one_live_trip_per_rider on trips (rider_id)
  where status in ('matching','accepted','arrived','in_progress');
create unique index one_live_trip_per_driver on trips (driver_id)
  where status in ('accepted','arrived','in_progress');

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  seq integer not null,
  lat double precision not null,
  lng double precision not null,
  address text not null,
  reached_at timestamptz,
  unique (trip_id, seq)
);

create table trip_locations (
  id bigserial primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  at timestamptz not null default now()
);
create index on trip_locations (trip_id, at);

create table dispatch_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  driver_id uuid not null references users(id) on delete cascade,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  response text not null default 'pending' check (response in ('pending','accepted','declined','expired','lost')),
  responded_at timestamptz,
  unique (trip_id, driver_id)
);
create index on dispatch_offers (driver_id, response);
create unique index one_pending_offer_per_trip on dispatch_offers (trip_id) where response = 'pending';
create unique index one_pending_offer_per_driver on dispatch_offers (driver_id) where response = 'pending';

create table charges (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete restrict,
  user_id uuid not null references users(id) on delete restrict,
  kind text not null check (kind in ('fare','tip','cancellation','refund')),
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  provider_ref text,
  failure_reason text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on charges (trip_id);
create index on charges (user_id, created_at desc);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  unique (trip_id, from_user_id)
);
create index on ratings (to_user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on messages (trip_id, created_at);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete set null,
  user_id uuid not null references users(id) on delete cascade,
  category text not null check (category in ('fare','cancellation_fee','route','lost_item','safety','driver','other')),
  body text not null check (length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text,
  refund_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on support_tickets (user_id);
create index on support_tickets (status, created_at);

create table share_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on share_links (trip_id);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references users(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  provider_ref text,
  created_at timestamptz not null default now(),
  unique (driver_id, period_start, period_end)
);

-- emails and SMS: always recorded; sent through a provider when keys are set
create table outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','sms')),
  to_addr text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','logged')),
  error text,
  created_at timestamptz not null default now()
);
create index on outbox (created_at desc);

create table webhook_events (
  id text primary key,
  provider text not null,
  type text not null,
  received_at timestamptz not null default now()
);
