const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    "Migratie niet toegepast. Ontbrekend geheim: DATABASE_URL (Postgres-verbinding voor Supabase-project fgznemnxnhdraoghfcwm). SUPABASE_SERVICE_ROLE_KEY en het databasewachtwoord zijn ook niet gezet.",
  );
  process.exit(2);
}

console.error("DATABASE_URL is gezet, maar deze omgeving past de migratie niet automatisch toe zonder een expliciete databaseclient. Voer supabase/migrations/20261110120000_provider_open_data.sql uit tegen die verbinding.");
process.exit(2);
