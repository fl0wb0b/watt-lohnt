# EV Rechner – Lohnt sich das Elektroauto?

Kleine installierbare PWA, die die Gesamtkosten eines Elektroautos mit denen
eines bestehenden Fahrzeugs vergleicht – inklusive Kaufpreis, Finanzierung,
Förderung, Steuer, Versicherung, Wartung und Ladekosten unter
Berücksichtigung einer eigenen PV-Anlage (Victron VRM).

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

- **Allgemeine Parameter**: Jahresfahrleistung, Betrachtungszeitraum, Strom-
  und Kraftstoffpreis, Einspeisevergütung, jährliche Kostensteigerung.
- **PV-Anlage**: PV-Jahresertrag, Eigenverbrauchsanteil und Haushaltsverbrauch
  bestimmen, wie viel der EV-Ladeenergie aus Solarüberschuss statt aus dem
  Netz kommt (Rechnung in `src/lib/vrm.ts#estimatePvShareForEv`).
- **Bestandsfahrzeug vs. neues Fahrzeug**: Presets für Tesla Model Y (BEV),
  BMW X3 xDrive20d/20i (Verbrenner) sowie ein frei editierbares Custom-Fahrzeug
  (`src/lib/presets.ts`). Alle Preset-Werte sind Richtwerte und sollten an das
  konkrete Angebot angepasst werden.
- **Ergebnis**: Vergleich der kumulierten Nettokosten (laufende Kosten
  abzüglich geschätztem Restwert) beider Pfade über den Betrachtungszeitraum,
  inkl. Break-even-Jahr. Berechnungslogik in `src/lib/calc.ts`. Es handelt
  sich um eine nominale Betrachtung ohne Diskontierung/Zinseszins auf das
  eingesetzte Kapital.

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
