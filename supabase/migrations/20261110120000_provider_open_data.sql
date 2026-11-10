-- Idempotent provider storage for KNMI, RWS, PDOK and Luchtmeetnet.
-- Target project: fgznemnxnhdraoghfcwm (https://fgznemnxnhdraoghfcwm.supabase.co).
-- Apply only with DATABASE_URL. This file contains no credentials.

create extension if not exists pgcrypto;

do $$
begin
  create extension if not exists postgis;
exception
  when insufficient_privilege or feature_not_supported or undefined_file then
    null;
end
$$;

create table if not exists provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  error_code text,
  records_processed integer not null default 0,
  next_retry_at timestamptz
);

create index if not exists provider_sync_runs_provider_started_idx
  on provider_sync_runs (provider, started_at desc);

create table if not exists provider_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dataset text not null,
  version text not null,
  raw_hash text not null,
  fetched_at timestamptz not null,
  published_at timestamptz,
  expires_at timestamptz,
  payload_json jsonb not null,
  unique (provider, dataset, raw_hash)
);

create index if not exists provider_snapshots_provider_fetched_idx
  on provider_snapshots (provider, fetched_at desc);

create table if not exists knmi_warnings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null,
  warning_set_uuid text not null,
  phenomenon text not null,
  publication_type text not null,
  generated_at timestamptz not null,
  unique (snapshot_id, warning_set_uuid)
);

create table if not exists knmi_warning_parts (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null,
  part_uuid text not null,
  severity text,
  color text,
  status text not null,
  onset timestamptz,
  expires timestamptz,
  headline text,
  polygon jsonb,
  unique (snapshot_id, part_uuid)
);

create index if not exists knmi_warning_parts_window_idx
  on knmi_warning_parts (onset, expires);

create table if not exists rws_measurement_locations (
  location_code text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  quantities jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null
);

create table if not exists rws_measurements (
  location_code text not null,
  quantity_code text not null,
  observed_at timestamptz not null,
  value double precision,
  unit text,
  quality_code text,
  source text not null default 'waterwebservices',
  primary key (location_code, quantity_code, observed_at)
);

create index if not exists rws_measurements_observed_idx
  on rws_measurements (observed_at desc);

create table if not exists air_stations (
  station_number text primary key,
  label text not null,
  latitude double precision not null,
  longitude double precision not null,
  station_type text,
  components jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null
);

create table if not exists air_measurements (
  station_number text not null,
  formula text not null,
  observed_at timestamptz not null,
  value double precision,
  unit text,
  primary key (station_number, formula, observed_at)
);

create index if not exists air_measurements_observed_idx
  on air_measurements (observed_at desc);

create table if not exists place_geo_cache (
  pdok_id text primary key,
  label text not null,
  place_type text not null,
  latitude double precision,
  longitude double precision,
  geometry jsonb,
  updated_at timestamptz not null
);
