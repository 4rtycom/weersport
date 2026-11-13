-- Weather alerts (meldingen): alerts per user, push subscriptions per device, and one row per delivered alert.
-- Idempotent. Mirrors ensureAlertsSchema() in lib/alerts/store.ts.

create table if not exists weather_alerts (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  sport_id text not null,
  place_id text not null,
  place_label text not null,
  latitude real not null,
  longitude real not null,
  min_score integer not null default 80,
  days text not null default 'any',
  channel_email integer not null default 1,
  channel_push integer not null default 0,
  active integer not null default 1,
  unsubscribe_token text not null unique,
  last_checked_at text,
  last_notified_at text,
  created_at text not null,
  updated_at text not null
);
create index if not exists weather_alerts_user_idx on weather_alerts (user_id);
create index if not exists weather_alerts_active_idx on weather_alerts (active);

create table if not exists push_subscriptions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at text not null
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

create table if not exists alert_deliveries (
  id text primary key,
  alert_id text not null,
  window_date text not null,
  window_label text not null,
  channel text not null,
  status text not null,
  detail text,
  created_at text not null,
  unique (alert_id, window_date, channel)
);
