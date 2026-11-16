# AIM · Schreibmodus: Prüfung und praktische Abnahme

## Umfang und Datenvertrag

AIM ist ein eigener Untermodus unter Brainstorm. Das bestehende Kartenboard und dessen vier gerichtete orthogonale Brainstorm-Nachbarschaften bleiben unverändert. AIM leitet aus einer einmal gemischten 4×5-Auswahl genau 80 ungeordnete Paare mit acht zyklischen Nachbarn ab. Anzeige und Rendern erzeugen keine Kartenrelationen.

Ein Eintrag in `matrixSessions` enthält `kind: 'aim'`, `version: 1`, `uid`, `cardUids` (20 UIDs in Matrixreihenfolge), `position` (0–80), `results` sowie `createdAt` und `updatedAt`. Ergebnisse haben `status: 'saved' | 'skipped' | 'unavailable'`; gespeicherte Ergebnisse nennen zusätzlich `cardUid`. Die Paarreihenfolge wird deterministisch abgeleitet. Nur eine aktuelle AIM-Session wird behalten; andere Arten von Matrixsessions werden nicht ersetzt.

Karte, manueller Verweis und Sessionfortschritt werden in einem geklonten Kandidaten mit den bestehenden Hierarchiehelfern erzeugt. Die bestehende IndexedDB-Write-Queue sichert den gesamten Kandidaten in einer Transaktion. Erst danach ersetzt er den sichtbaren State. Andere Schreibaktionen und Gist-Sync sind währenddessen gesperrt. Fehler lassen Originalzustand und Entwurf erhalten; erneutes Speichern ist möglich. Die Relationshelfer unterstützen dafür optional `deferSave`, ohne ihr Standardverhalten zu ändern.

Sessions sind lokal und in `state/S.json` des Recovery-ZIPs enthalten. Der Gist-Vertrag bleibt unverändert; Karten und manuelle Verweise werden regulär synchronisiert. Bestehende Sync-Materialisierung erhält lokale Sessions. Die App besitzt derzeit keinen Backup-Importmechanismus; ein neuer Import wurde nicht hinzugefügt.

Entwürfe liegen separat je Session und Paarposition unter `rilke_aim_draft_<uid>_<position>` in `localStorage`, mit Arbeitsspeicher-Fallback und Schließwarnung. Sie werden nach erfolgreichem Speichern beziehungsweise bestätigtem Überspringen entfernt. Entwürfe sind nicht im ZIP oder Gist enthalten. Fehlende, archivierte oder per Tombstone entfernte Ausgangskarten werden nicht ersetzt oder neu gemischt; betroffene Paare können ausdrücklich übersprungen werden.

## Reproduzierbare automatisierte Prüfungen

Aus dem Repository-Root, mit Node.js und Python 3:

```sh
for test in tests/*-smoke.js; do node "$test" || exit "$?"; done
python3 -m http.server 8000 --bind 127.0.0.1
```

In einer zweiten Shell, ebenfalls im Repository-Root:

```sh
node tests/aim-browser.cjs
node --check sw.js
git diff --check
```

Der Browsertest benötigt das Node-Modul `playwright` und Chromium. Beide sind in der eingerichteten Cloud-Umgebung vorhanden. Optional lassen sich `CHROMIUM_PATH` und `RILKE_TEST_URL` setzen. Standard sind `/usr/bin/chromium` und der lokale Server auf Port 8000. Der Test verwendet einen frischen, isolierten Browserkontext mit eigenen Testkarten; vorhandene Browserdaten werden nicht verändert. Er simuliert gezielt einen IDB-Fehler und verwirft danach seine Browserdaten. Eine Aufnahme der mobilen Schreibansicht liegt anschließend unter `/tmp/rilke-aim-mobile.png`.

Am 16.11.2026 erfolgreich ausgeführt:

- Acht Node-Smoke-Skripte: AIM-Mathematik einschließlich Randdiagonalen, Grad acht, 80 eindeutige Paare, stabile Reihenfolge und ungültige Sessions; außerdem alle sieben bisherigen Regressionen für Karten, Keyboard, Relationen und Kompositionen.
- Chromium: eigener poetischer Satz unter A und weiterer Satz unter B, Parent/SID/Order und manueller Verweis, Anzeige im Zettelkasten, Rückkehr zu AIM.
- Überspringen ohne neue Inhaltsdaten; Schutz eines vorhandenen Entwurfs bei abgebrochener Bestätigung; Whitespace erzeugt keine Karte.
- Reload mit identischer Matrix, Paarposition und wiederhergestelltem Entwurf.
- Simulierter Write-Fehler: sichtbarer und tatsächlich persistierter State bleiben unverändert; Text bleibt erhalten; Retry erzeugt genau eine Karte.
- Ausstehender gewöhnlicher Kartensave bei fehlgeschlagenem AIM-Start und AIM-Fortschritt: Debounce wird wiederhergestellt; die Kartenänderung bleibt nach Reload erhalten, AIM-Karte/Relation/Fortschritt bleiben ungespeichert. Der neue Regressionstest schlägt ohne den Fix fehl.
- Verzögerter Write und Doppelauslösung: genau ein Write; keine vorzeitig sichtbaren Kandidatendaten; gleichzeitiges Bearbeiten und Sync blockiert.
- SID-Prüfung nur für die neue Karte und tatsächlich umbenannte Karten: bestehende, unbeteiligte SID-Dopplungen bleiben erlaubt. Browserregression mit 21 Root-Karten, Archivierung der letzten Karte und regulärer Wiederverwendung von SID `21`; AIM speichert danach erfolgreich einschließlich Reload. Neue und durch Rebasing eingeführte Kollisionen bleiben gesperrt.
- Archivierte und entfernte Ausgangskarten, ungültige Parent-Referenz, Zyklus, SID-Konflikt und vorhandene Order-Lücke.
- Tatsächlich erzeugtes Recovery-ZIP enthält den Sessionfortschritt in `state/S.json`; Gist-State enthält keine Sessions und die Materialisierung erhält die lokale Session.
- Offline mit aktivem Service Worker: Fragment unter B speichern, offline neu laden und Karte sowie Sessionposition wiederfinden.
- Alle restlichen Paare bis zum Abschluss übersprungen; weniger als 20 Ausgangskarten verhindern eine neue Session.
- Mobile Ansicht bei 390×844 ohne horizontalen Überlauf; Tab/Enter-Bedienung und Editorfokus nach dem Speichern; keine JavaScript-Seitenfehler.
- Bestehendes Kartenboard erzeugt weiterhin vier orthogonale Brainstorm-Relationen; Wechsel zwischen Board und AIM erzeugt keine zusätzlichen Relationen.
- Syntax aller Inline-Skripte und des Service Workers sowie `git diff --check`.

## Praktische Abnahme mit eigenen Karten

1. Bei Bedarf zuerst ein Recovery-ZIP der eigenen Inhalte erstellen. Mindestens 20 aktive Karten bereithalten.
2. **Brainstorm → AIM · Schreiben → Neue AIM-Session** öffnen. Bei vorhandener Session zunächst fortsetzen.
3. Beide Texte lesen, ein eigenes Fragment schreiben und **Unter A speichern** wählen. Im Kartenmodus das neue Kind samt SID und manuellem Verweis zur zweiten Ausgangskarte prüfen.
4. Zu AIM zurückkehren. Einen weiteren Satz **Unter B speichern**, danach ein Paar überspringen.
5. Einen Entwurf beginnen, zum Kartenmodus wechseln, zurückkehren und den erhaltenen Text prüfen. Beim Überspringen die Verwerfen-Bestätigung zunächst abbrechen.
6. Seite neu laden und wieder AIM öffnen: gleiche Ausgangskarten, gleicher Fortschritt und erhaltener Entwurf. Diesen einmal speichern; es darf kein Duplikat entstehen.
7. Auf dem eigenen Smartphone prüfen, ob Textlängen, Schreibfläche und Speichertasten angenehm nutzbar sind. Desktop zusätzlich nur mit Tab/Shift+Tab und Enter bedienen.

Diese persönliche Produktabnahme steht aus. Ebenso wurden keine reale Zwei-Geräte-Gist-Synchronisation, Desktop-PWA-Installation oder Veröffentlichung durchgeführt. Sie werden nicht durch die automatisierten Prüfungen behauptet. Der Service-Worker-Cache ist für die neue App-Shell auf `v2` erhöht; bestehende Installationen übernehmen sie über den normalen Worker-Lifecycle.
