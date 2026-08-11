# Watt lohnt? – Lohnt sich das Elektroauto?

**Live: https://fl0wb0b.github.io/watt-lohnt/**

powered by [fL0wb0b](https://github.com/fl0wb0b)

Installierbare PWA, die die Gesamtkosten eines Elektroautos mit denen
eines bestehenden Fahrzeugs vergleicht – inklusive Kaufpreis, Finanzierung
(Barkauf/Kredit/Ballon/Leasing), Förderung, THG-Quote, Steuer, Versicherung,
Wartung und Ladekosten unter Berücksichtigung einer eigenen PV-Anlage
(Victron VRM).

Alles läuft rein clientseitig im Browser, es gibt kein Backend. Eingaben
werden nicht gespeichert oder übertragen (außer beim optionalen VRM-Live-Abruf,
der direkt vom Browser aus `vrm.victronenergy.com` anspricht).

## Nutzung

```bash
npm install
npm run dev       # lokaler Dev-Server
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal testen
```

## Funktionsweise

- **Allgemeine Parameter**: Betrachtungszeitraum, Kostensteigerung p.a.,
  Strompreis (Netzbezug), Einspeisevergütung, sowie getrennte Diesel-/
  Benzinpreise (Richtwerte, Stand Anfang August 2026 – bitte an aktuelle/
  lokale Preise anpassen, z.B. über ADAC oder clever-tanken.de).
- **Jahresfahrleistung & Verbrauch pro Fahrzeug**: sowohl Bestandsfahrzeug
  als auch neues Fahrzeug haben eigene Felder für km/Jahr und Verbrauch –
  wichtig, wenn sich das Nutzungsverhalten unterscheiden soll.
- **PV-Anlage + Anwesenheitsprofil**: PV-Jahresertrag, Eigenverbrauchsanteil
  und Haushaltsverbrauch (aus VRM oder manuell) sowie ein Wochentage-Profil,
  an welchen Tagen tagsüber jemand zuhause ist und laden kann. Nur der
  Überschuss an Anwesenheitstagen gilt als für die Ladung nutzbar – der Rest
  läuft (ohne Heimspeicher) real ins Netz und würde beim Laden aus dem
  Netzstrom zum eingestellten Strompreis kommen (Rechnung in
  `src/lib/vrm.ts#estimatePvShareForEv`). Für kleine Anlagen bzw. wenn PV
  nicht reicht, wird der Rest automatisch zum Netz-Strompreis abgerechnet.
- **Finanzierung des neuen Fahrzeugs**: Barkauf, Kredit, Ballonfinanzierung
  (Schlussrate am Laufzeitende) oder Leasing – jeweils mit eigener
  Cashflow-Simulation (`src/lib/calc.ts#computeCarResult`). Der Verkaufserlös
  des Altfahrzeugs kann optional als Anzahlung/Sondertilgung für das neue
  Fahrzeug verwendet werden.
- **Bestandsfahrzeug vs. neues Fahrzeug**: Presets für Tesla Model Y, VW ID.4
  Pro, Hyundai Ioniq 5 (BEV, Verbrauchswerte orientiert an der EV Database),
  BMW X3 xDrive20d/20i (Verbrenner) sowie ein frei editierbares Custom-Fahrzeug
  (`src/lib/presets.ts`). Alle Preset-Werte sind Richtwerte und sollten an das
  konkrete Angebot angepasst werden. Die Wartungskosten-Vorbelegung (BEV
  spürbar niedriger als Verbrenner) orientiert sich an gängigen
  Kostenvergleichen (u.a. ADAC) – keine Wunderdinge, aber ein realistischer
  Ausgangspunkt.
- **Wirtschaftliche Zusatzfaktoren, die das Ergebnis sonst verfälschen
  würden**:
  - **Kfz-Steuer-Befreiung ist befristet** (aktuell gesetzlich bis 2030/31):
    ab wählbarem Jahr greift für BEV wieder eine (geschätzte) Steuer, statt
    dauerhaft 0 € anzunehmen.
  - **THG-Quote**: jährlicher Erlös aus dem Verkauf der THG-Prämie für
    BEV-Halter (Richtwert ca. 100–350 €/Jahr), reduziert die laufenden Kosten.
  - **Wallbox**: einmalige Anschaffungs-/Installationskosten fürs BEV (0,
    falls schon vorhanden) – wird sonst leicht vergessen.
  - **Ladeverluste**: AC-Laden zuhause verliert real ca. 8–12 % gegenüber dem
    reinen Fahrzeugverbrauch – der tatsächliche Strombezug (PV+Netz) ist
    entsprechend höher angesetzt.
  - **CO2-Bepreisung**: fossile Kraftstoffe bekommen zusätzlich zur
    allgemeinen Kostensteigerung einen eigenen Preisaufschlag pro Jahr
    (BEHG/EU-ETS2), Strom nicht.
  - **Kapitalkosten (optional)**: ein Kalkulationszins > 0 % diskontiert alle
    Zahlungsströme auf den heutigen Wert – relevant, wenn das für ein Auto
    eingesetzte Kapital sonst investiert würde. 0 % = klassische nominale
    Betrachtung.
- **Ergebnis**: Vergleich der kumulierten Nettoposition (tatsächliche
  Kassenausgänge + noch offene Finanzierungsschuld − geschätzter Restwert,
  bei Leasing kein Restwert) beider Pfade über den Betrachtungszeitraum,
  inkl. Break-even-Jahr im Chart. Berechnungslogik in `src/lib/calc.ts`.

### Rechenlogik prüfen

`npm run check:calc` führt `scripts/sanity-check.mts` aus – ein paar
durchgerechnete Szenarien (Amortisation, Anwesenheits-/PV-Anteil, Kredit vs.
Ballon vs. Leasing vs. Barkauf für dasselbe Fahrzeug) mit erwarteten
Größenordnungen, um Regressionen bei Änderungen an der Rechenlogik früh zu
bemerken.

## Automatischer Share-Link-Abruf (Proxy)

Der eleganteste Weg: Nutzer fügen nur ihren VRM-**Share-Link** ein, die App holt PV-Ertrag,
Verbrauch und Netzeinspeisung automatisch. Technisch läuft das so (per Netzwerk-Analyse des
echten VRM-Dashboards ermittelt):

1. `POST https://vrmapi.victronenergy.com/v2/auth/verifyshare` mit `{ idSite, token }`
   (`token` = Share-Hash aus dem Link) → liefert ein 24h gültiges anonymes Bearer-JWT.
2. `GET /v2/installations/{idSite}/overallstats` mit diesem JWT → `records.year.totals`
   (`total_solar_yield`, `total_consumption`, `grid_history_to`, alle in kWh).

**Haken:** Victron sendet für fremde Origins keine CORS-Header, ein direkter Browser-Abruf von
GitHub Pages wird also blockiert. Lösung ist ein winziger, kostenloser Proxy, der die Anfrage
serverseitig (ohne CORS-Sperre) weiterreicht: `workers/vrm-proxy.js` (Cloudflare Worker).

Deploy des Proxys (einmalig, kostenlos):

```bash
npx wrangler deploy workers/vrm-proxy.js --name vrm-proxy
# oder im Cloudflare-Dashboard: Workers & Pages → Create Worker → Inhalt einfügen → Deploy
```

Die vergebene Worker-URL (z.B. `https://vrm-proxy.deinname.workers.dev`) trägt man in der App im
Tab „VRM-Live" ins Feld **Proxy-URL** ein (wird im Browser lokal gespeichert). Danach genügt der
reine Share-Link – ganz ohne VRM Access Token. Der Proxy reicht ausschließlich `/v2/*` an Victron
weiter und speichert/protokolliert nichts.

## Victron VRM – Live-Abruf vs. manuelle Eingabe

Ein öffentlicher VRM-**Share-Link** (`.../installation/{id}/share/{token}`)
ist eine reine Dashboard-Ansicht im Browser des Betrachters und keine von
Drittanbieter-Seiten aus aufrufbare API – Victron sieht dafür kein CORS/Auth
vor. Ein echter Live-Abruf funktioniert daher nur mit einem persönlichen
**VRM Access Token** (VRM → Preferences → Integrations → Access tokens),
das zusätzlich zum Link/zur Installations-ID eingegeben werden kann.
Schlägt der Abruf fehl (falscher Token, Netzwerk/CORS, unerwartetes
Antwortformat), erscheint eine Fehlermeldung und die Werte können wie gehabt
manuell aus dem eigenen VRM-Dashboard eingetragen werden – das ist der
zuverlässige Standardweg.

## PWA

Die App ist über `vite-plugin-pwa` als installierbare PWA konfiguriert
(Manifest, Icons, Service Worker mit Offline-Caching der App-Shell). Icons
lassen sich aus `scripts/icon-source.svg` neu generieren:

```bash
npm install -D sharp
node scripts/gen-icons.mjs
npm uninstall sharp
```
