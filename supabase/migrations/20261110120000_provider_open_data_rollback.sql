-- Rollback for 20261110120000_provider_open_data.sql. Does not delete auth or billing tables.

drop table if exists place_geo_cache;
drop table if exists air_measurements;
drop table if exists air_stations;
drop table if exists rws_measurements;
drop table if exists rws_measurement_locations;
drop table if exists knmi_warning_parts;
drop table if exists knmi_warnings;
drop table if exists provider_snapshots;
drop table if exists provider_sync_runs;
