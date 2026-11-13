# WeerSport

Nederlandse webapp voor het beste moment om buiten te sporten.

## Starten

```bash
npm install
npm run dev
```

De site staat daarna op `http://localhost:3000`.

Accounts staan lokaal in `data/weersport.sqlite`. Er is geen mailserver gekoppeld; verificatie- en herstellinks verschijnen in de ontwikkelmailbox op het scherm. Zet `WEERSPORT_DB` als het databasebestand ergens anders moet staan.

Open data (KNMI, Rijkswaterstaat, PDOK, Luchtmeetnet) staat achter flags die standaard uit staan. Zie `docs/data-sources.md`. `KNMI_API_KEY` wordt alleen van de serveromgeving gelezen en hoort niet in git.

## Controles

```bash
npm run check
npm run check:data
npm run lint
npm run build
WEERSPORT_BASE_URL=http://127.0.0.1:3000 npm run check
```

## Scope

- Phase 01: ontwerpsysteem, homepage en `/sporten`.
- Phase 02: authenticatiepoort en Nederlandse plaatscontrole via PDOK.
- Phase 03: bronadapters, UV onafhankelijk van score, `NO_SCORE` bij ontbrekende kritieke water-/ijsdata, testdata nooit als live.

### Bronnen in Phase 03

| Bron | Status zolang de bijbehorende flag uit staat |
|---|---|
| Open-Meteo weer/UV | Ongewijzigde live adapter met CC BY 4.0-bronvermelding |
| KNMI waarschuwingen 1.0 | `NOT_LINKED`. Een ontbrekende of uitgeschakelde feed is geen leeg waarschuwingsbeeld |
| Rijkswaterstaat WaterWebservices | `NOT_LINKED`. Geen watermeting uit luchttemperatuur |
| Luchtmeetnet | `NOT_LINKED`. Geen adresluchtkwaliteit en geen 48-uursvoorspelling |
| Zwemwater / BIJ12 | `NOT_LINKED` |
| PDOK | Live woonplaats- en centroïde-lookup. Suggest, reverse en sportspot alleen met `DATA_PDOK_V2_ENABLED` |

Gevalideerde sportscore 0–100, quota, Mollie en AdSense horen bij latere fases.

## Meldingen (e-mail en push)

Gebruikers zetten op een sportmoment "Meld me als het goed wordt" aan en beheren meldingen onder **Account → Meldingen**. Elke ochtend om 05:00 UTC roept Vercel Cron `/api/internal/alerts/run` aan (zie `vercel.json`). Per plek wordt één verwachting opgehaald; per melding en dag gaat er hooguit één mail en één pushbericht uit.

Zet in Vercel:

| Variabele | Waarde |
|---|---|
| `RESEND_API_KEY` | API-sleutel uit Resend |
| `ALERT_FROM_EMAIL` | Afzender op een in Resend geverifieerd domein, bijv. `WeerSport <meldingen@jouwdomein.nl>` |
| `CRON_SECRET` | Willekeurige lange string; Vercel stuurt die mee als `Authorization: Bearer …` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Maak ze met `npm run vapid`; de privésleutel nooit in git |
| `VAPID_SUBJECT` | `mailto:` met een adres waarop pushdiensten je kunnen bereiken |

Pas bij Postgres eerst `supabase/migrations/20261113213000_weather_alerts.sql` toe. Op iPhone en iPad werkt push alleen als WeerSport aan het beginscherm is toegevoegd. Controle: `npm run check:alerts`.
