# WeerSport

Nederlandse webapp voor het beste moment om buiten te sporten.

## Starten

```bash
npm install
npm run dev
```

De site staat daarna op `http://localhost:3000`.

Accounts staan lokaal in `data/weersport.sqlite`. Er is geen mailserver gekoppeld; verificatie- en herstellinks verschijnen in de ontwikkelmailbox op het scherm. Zet `WEERSPORT_DB` als het databasebestand ergens anders moet staan. Optioneel: `KNMI_API_KEY` (nog niet aangesloten op een waarschuwingsendpoint).

## Controles

```bash
npm run check
npm run lint
npm run build
WEERSPORT_BASE_URL=http://127.0.0.1:3000 npm run check
```

## Scope

- Phase 01: ontwerpsysteem, homepage en `/sporten`.
- Phase 02: authenticatiepoort en Nederlandse plaatscontrole via PDOK.
- Phase 03: bronadapters, UV onafhankelijk van score, `NO_SCORE` bij ontbrekende kritieke water-/ijsdata, testdata nooit als live.

### Bronnen in Phase 03

| Bron | Status in deze fase |
|---|---|
| Open-Meteo weer/UV | Live adapter met CC BY 4.0-bronvermelding; vendorkeuze blijft open |
| KNMI waarschuwingen | `NOT_LINKED` zonder verzonnen alerts |
| RWS WADAR | `NOT_LINKED` |
| Zwemwater / BIJ12 | `NOT_LINKED` |
| PDOK | Live plaats- en centroïde-lookup |

Persoonlijk advies is nog voor geen sport vrijgegeven. Openwaterzwemmen blijft `NO_SCORE` zonder officiële zwemplek en geldige metingen. Het oude temperatuur/wind/regen-gewicht is verwijderd. Quota, Mollie en AdSense blijven actief voor een latere, gevalideerde score.
