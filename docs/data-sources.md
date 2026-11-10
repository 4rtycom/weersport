# Databronnen

Dit document hoort bij de open-data-integratie. Het is geen verklaring dat de koppeling productiegereed is.

## Flags

Deze variabelen staan uit tenzij ze exact `true` zijn:

- `DATA_KNMI_ENABLED`
- `DATA_RWS_ENABLED`
- `DATA_PDOK_V2_ENABLED`
- `DATA_LUCHTMEETNET_ENABLED`

Uit betekent: KNMI, Rijkswaterstaat en Luchtmeetnet blijven `NOT_LINKED` en er wordt voor die bronnen niets bij een paginabezoek opgehaald. Open-Meteo blijft de weer- en UV-bron. PDOK-woonplaatszoeken blijft werken zoals voorheen. Suggest, reverse en een optionele `sportSpot` gaan pas mee als `DATA_PDOK_V2_ENABLED` aan staat.

## Sleutels

`KNMI_API_KEY` wordt alleen op de server gelezen, als `Authorization`-header naar `https://api.dataplatform.knmi.nl`. De waarde staat niet in deze repository. Een afgekapte sleutel telt als afwezig. Zonder bruikbare sleutel, of met de flag uit, is de status `NOT_LINKED`. Dat is geen melding dat er geen waarschuwingen zijn.

`DATA_SYNC_SECRET` beschermt `POST /api/internal/data/sync` en `/admin/data-sources`. Zonder dat geheim is de sync gesloten.

## Opslag

De idempotente migratie staat in `supabase/migrations/20261110120000_provider_open_data.sql`, met een rollback ernaast. Doelproject: `fgznemnxnhdraoghfcwm`.

De migratie is in deze omgeving niet toegepast. Ontbrekend geheim: `DATABASE_URL` (Postgres-verbinding). `SUPABASE_SERVICE_ROLE_KEY` en het databasewachtwoord zijn niet aangeleverd. Tot die verbinding er is, blijft ingestie in het procesgeheugen en overleeft die geen nieuwe deploy.

## Gedrag per bron

- KNMI-dataset `KNMI-public-weather-warnings` versie `1.0`, alleen `public_warnings_*.json` vanaf 2026-11-02. Een bestand vervangt de vorige snapshot. `test` wordt niet getoond. Heartbeats blijven geldig. Leeg én vers is een geldige situatie zonder actuele waarschuwing. Een lege of oude feed wordt niet zo genoemd.
- RWS WaterWebservices: catalogus en laatste waarnemingen. Een woonplaatscentroïde krijgt geen meetpunt. Stroming wordt alleen getoond als `STROOMSHD` voor dat punt in de catalogus staat. Kwaliteitscode `99` wordt `null`.
- Luchtmeetnet: per stof een station binnen 20 km dat die stof meet, met een limiet onder 100 verzoeken per 5 minuten. Ouder dan 3 uur is niet live. De waarde gaat niet de 48-uursscore in.
- PDOK: `free` en `lookup` blijven de woonplaatsbron. Coördinaten zijn WGS84; `POINT(lon lat)` wordt niet omgedraaid. Punten buiten Nederland worden geweigerd.

## Score

Het uurvenster voor de comfortscore is 48 uur, in Europe/Amsterdam, ook als een Open-Meteo-tijdstip geen offset heeft. Ontbrekende UV blijft `null`. Natuurijs blijft `NO_SCORE`. Openwaterzwemmen blijft `NO_SCORE` zolang er geen officiële zwemwaterstatus is. Andere watersporten scoren alleen met een geaccepteerde meting op een onderbouwd meetpunt. De comfortscore is geen veiligheidsgoedkeuring.

## Geen productiegereed

Een geslaagde typecheck of build zegt niet dat de bronnen in productie actueel, volledig of vergund zijn. De flags blijven uit tot er een stagingcontrole met echte antwoorden is én de databaseverbinding de migratie heeft toegepast.
