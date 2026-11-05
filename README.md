# WeerSport

Nederlandse webapp voor het beste moment om buiten te sporten. Deze repository bevat Phase 01 en Phase 02: het ontwerpsysteem, de responsive homepage, de authenticatiepoort en Nederlandse plaatscontrole.

## Starten

```bash
npm install
npm run dev
```

De site staat daarna op `http://localhost:3000`.

Accounts staan lokaal in `data/weersport.sqlite`. Er is geen mailserver gekoppeld. Verificatie- en herstellinks verschijnen daarom in de ontwikkelmailbox op het scherm. Zet `WEERSPORT_DB` als het databasebestand ergens anders moet staan. Zet `WEERSPORT_COOKIE_SECURE` niet; cookies worden alleen `Secure` als het verzoek zelf via HTTPS binnenkomt.

## Controles

```bash
npm run check
npm run lint
npm run build
WEERSPORT_BASE_URL=http://127.0.0.1:3000 npm run check
```

De laatste regel test de auth- en zoekroutes tegen een draaiende server.

## Scope

- Phase 01: Manrope, kleuren, iconen, homepage en `/sporten` op 320–1440 px.
- Phase 02: account, e-mailverificatie, wachtwoordherstel en een zoekpoort die de gekozen sport, Nederlandse woonplaats en periode bewaart.
- Een anonieme zoekactie opent de poort en start geen analyse. Ook een geverifieerd account boekt in deze fase geen aanvraag.
- Het scorevoorbeeld op de homepage blijft fictief.

Live weer, scores, quota, Mollie en AdSense horen bij latere fases. Doorgaan met Google is in het ontwerp een concept en is niet gekoppeld.
