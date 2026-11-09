# Sponsorpilot lokaal testen

De publieke pagina `/sponsoring` is geen campagneformulier meer. Nieuwe sponsoring is een maandcontract per sport. De commando's hieronder gelden alleen voor historische pilotaanvragen. Een oude lead of betaalde pilot wordt geen automatische incasso. Nieuwe contracten lopen via de aanmeldpagina, `npm run sponsor -- moderate` en `npm run sponsor -- collect`.

De publieke pagina `/sponsoring` is een directe sponsoraanvraag (`requestType` `campaign_v1`). Er staat geen pakketprijs op. Verzenden bewaart sport, plaats, bereik, periode en contact in dezelfde database en plant niets in. Zoek de aanvraag na een herstart met `npm run sponsor -- list` en `npm run sponsor -- show <aanvraag-id>`.

De betaalde pilot staat uit. `WEERSPORT_SPONSOR_PILOT_BOOKABLE` blijft leeg tot een aanvraag na een herstart nog in de database staat en het eindrapport klopt. Dit bestand publiceert geen campagne en verplaatst geen productie-alias.

De database is het lokale SQLite-bestand (`WEERSPORT_DB`, anders `data/weersport.sqlite`). Dat bestand is niet gedeeld tussen servers. Dat is een releaseblokkade voor verkoop.

## Eerste testcampagne

Start de app met dezelfde database als het beheercommando:

```bash
npm run dev
```

1. Open `http://127.0.0.1:3000/sponsoring`.
2. Kies pilot, vul naam, organisatie, e-mail en bericht in, kies één sport en één plaats. Verstuur. Bewaar het aanvraagnummer. Er gaat geen mail uit.
3. Bekijk de aanvraag:

```bash
npm run sponsor -- list
npm run sponsor -- show <aanvraag-id>
```

4. Stuur het voorstel zelf. Leg het akkoord vast pas als de factuur handmatig is afgehandeld, of spreek een kosteloze meetpilot af:

```bash
npm run sponsor -- agree <aanvraag-id> --price 9900
npm run sponsor -- agree <aanvraag-id> --complimentary
```

5. Plan de campagne. Zonder `--production` blijft het een testcampagne: zichtbaar op `npm run dev`, niet meegeteld in productierapporten.

```bash
npm run sponsor -- schedule <aanvraag-id> \
  --start 2026-11-06 \
  --sport hardlopen \
  --place wpl-… \
  --partner "Loopatelier Ede" \
  --headline "Welke schoen past bij jouw rondje?" \
  --body "Van asfalt tot heidepad. In onze winkel in Ede kun je verschillende hardloopschoenen passen en vergelijken." \
  --url https://example.com/loopatelier-ede
```

6. Log in, kies die sport en die plaats, geef cookie-toestemming en open het sportmoment. De vermelding staat onder het advies. Zonder passende sport, plaats, score, toestemming of bij Pro verschijnt zij niet.
7. Exporteer het rapport:

```bash
npm run sponsor -- report <campagne-id>
npm run sponsor -- report <campagne-id> --csv
```

Pauzeren en hervatten:

```bash
npm run sponsor -- pause <campagne-id>
npm run sponsor -- resume <campagne-id>
```

## Wat Glenn nog zet vóór een echte pilot

- Gedeelde database, niet dit ene SQLite-bestand.
- `WEERSPORT_SPONSOR_EVENT_SECRET` van minstens 16 tekens op productie. Zonder geheim wordt daar geen vermelding getoond.
- `WEERSPORT_SPONSOR_PILOT_BOOKABLE=1` pas na de herstartcontrole. Tot die tijd vraagt de pagina alleen informatie.
- Mail blijft uit. `WEERSPORT_BUSINESS_INBOX` bewaart alleen een adres bij de aanvraag.
- Facturen blijven handmatig. Er is geen productiebetaling.

## Terugdraaien

Zet de vlaggen uit en deploy de vorige revisie. Oude aanvragen blijven leesbaar. Nieuwe tabellen mogen blijven; de vorige code schrijft ze niet. Weggooien kan met `DROP TABLE sponsor_events; DROP TABLE sponsor_campaigns;`.
