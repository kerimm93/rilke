# Prüfprotokoll · 2.1.1

Stand: 4. Oktober 2026. Die 49 Kern- und Regressionstests prüfen den ausgelieferten HTML-Code von 2.1.1. Der unten dokumentierte Browser-Durchlauf stammt aus 2.1.0; für 2.1.1 wurde er wegen der inzwischen fehlenden Chromium-Laufzeit nicht erneut ausgeführt.

## Ergebnis

- **49 Kern- und Regressionstests bestanden**, einschließlich JavaScript-Syntaxprüfung mit vm.Script.
- **Browser-Integrationstest für 2.1.0 bestanden**, Chromium 153.0.8010.0; kein neuer Browser-Testnachweis für 2.1.1.
- Echte DOM-Bedienung, IndexedDB, Web Locks, Web Crypto, Downloads und Service Worker.
- Zwei getrennte Browser-Kontexte für Desktop und Mobilgerät, zusätzlich ein eigener Kontext für die Altdaten-Migration.
- 5 simulierte Gist-PATCHes, 1 simuliertes Anki-addNote. Keine JavaScript-Page-Errors.
- 390px Mobilbreite ohne horizontalen Überlauf; Eingang, persönliche Vorlagen und Protokoll visuell geprüft.

## Neue Prüfungen

Korrektur 2.1.1: Der Regressionstest mit mehr als einem Tag zwischen Vorschau und Bestätigung schlug vor der Korrektur am zu frühen Importzeitpunkt fehl und besteht danach. Er prüft gespeicherten State, Protokoll, Session-/Kartenzeitstempel und identischen Wiederholungsimport. Zwei weitere Tests prüfen Abbruch ohne Zustandsänderung sowie Speicherfehler mit erhaltenem Entwurf und neu datiertem Wiederholungsversuch.

- Standard für neue Sessions: Notion / flexibel, ohne direkte Anki-Payloads.
- Editierbare Vorlagen, lokale Speicherung, Verschlüsselung und Übernahme auf ein zweites Gerät.
- Session-Snapshot bleibt nach späterer Änderung der globalen Vorlage unverändert.
- Mehrfache Variablen werden ersetzt; Marker im Quelltext werden nicht rekursiv ausgewertet.
- Fehlende Input-/Schema-Variablen lassen verpflichtende Daten nicht verschwinden.
- Speicherfehler erhält bisherigen Zustand und ungespeicherten Vorlagenentwurf.
- Öffentliche HTML-Defaults enthalten keine persönliche Notion-Sammlungs-ID.
- Freie Routen, leeres user_processing, mehrere Aktionen und beliebig verschachtelte Zusatzfelder.
- Zusatzfelder bleiben in Originalhandoff, State, verschlüsseltem Gist, Backup und Protokollexport erhalten.
- Action-only-Ergebnis mit konkreter erledigter Aktion gültig; geplante/fehlgeschlagene Aktionen dürfen keinen vollständigen Erfolg vortäuschen.
- Falsche Session-/Highlight-ID, ungültiger Status und ausführbare URL werden blockiert.
- Handoff-Replay erzeugt keine weitere Karte oder Protokollzeile.
- Erneutes Aufgreifen erhält vorherige Verarbeitung; eine neue Bilanz fügt eine Zeile hinzu.
- Importzeit bleibt auch bei späterem Karten-/Session-Update unverändert.
- Freie Texte und JSON werden beim Anzeigen HTML-escaped.
- Vorlagen werden einzeln zusammengeführt; gleichzeitige Bearbeitung derselben Vorlage erzeugt Konflikt.
- Ein ansonsten leeres Gerät mit eigenen Vorlagen wird nicht still durch einen fremden Workspace ersetzt.
- Legacy-State und alte Vergleichsbasis werden deterministisch normalisiert, ohne Scheinkonflikte.
- Tatsächlicher Boot aus alter IndexedDB-Struktur erhält Handoff und bestätigte Anki-Note-ID; unbekannte historische Importzeit bleibt null.

## Browser-Durchlauf

1. Synthetische Readwise-Kandidaten laden; Sortierung, Schnellauswahl und Persistenz prüfen.
2. Anki-Session auf A beginnen, Zwischenstand speichern, Gist initialisieren.
3. Leeres Gerät B lädt denselben Workspace. Gist liefert absichtlich gekürzten Inline-Inhalt; vollständiger Raw-Fallback wird benötigt.
4. B setzt fort und speichert Handoff-Entwurf. A übernimmt, prüft/freigibt und synchronisiert genau eine Anki-Karte.
5. Rückweg auf B, unveränderter Abgleich ohne PATCH, Handoff-Replay ohne Doppelanlage.
6. Auf A persönliche Notion-Vorlage speichern und einen erledigten Kandidaten erneut aufgreifen.
7. Neue Session mit Notion-Workflow beginnen, Zwischenstand und Vorlagen auf B übertragen.
8. Auf B mit frei benannter Sprint-/Time-Sector-Verwendung und verschachtelten Zusatzdaten abschließen. Keine zusätzliche Anki-Anlage.
9. Vollständiges Protokoll über echten Browserdownload exportieren, Inhalte prüfen und zurück auf A synchronisieren.
10. Separaten Kontext mit altem State befüllen; Reload führt die produktive Migration aus.
11. Zweittab-Schreibschutz, IndexedDB-Reload und Offline-App-Shell prüfen.

## Grenzen

Externe Readwise-, GitHub- und Anki-Dienste waren simuliert. Es wurden keine echten Konten, Notion-Seiten oder Anki-Sammlungen verändert. Der Notion-Beispielwrite im Test ist ausdrücklich synthetisch.

Damit sind App-Verhalten, Datenfluss und Migration geprüft. Ein realer Durchlauf mit persönlicher Zielstruktur, echtem Gist, tatsächlichem Mobilgerät und gegebenenfalls AnkiConnect steht als Nutzerabnahme noch aus. Safari/iOS und Firefox wurden in diesem Update nicht separat getestet.

## Reproduzieren

```bash
node --test tests/*.test.cjs
CHROMIUM_PATH=/pfad/zu/chromium TEST_OUTPUT_DIR=/tmp/rww-tests node tests/browser.cjs
```

Playwright wird nur zur Entwicklung benötigt. Die ausgelieferte PWA selbst hat keine npm-Abhängigkeiten und keinen Build-Schritt.
