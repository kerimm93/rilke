# Readwise Workbench 2.1.1

Readwise-Highlights auswählen, im Chat bewusst verwenden und ihre **initiale Verarbeitung** dokumentieren. Die Workbench plant keine Lernwiederholungen. Ein in die Lernsammlung übergebenes Highlight kann bereits verarbeitet sein, ohne gelernt zu sein.

Single-File-HTML-PWA, Vanilla JavaScript, lokal zuerst, kein Build-Schritt und kein Backend.

## Korrektur in 2.1.1

Der Importzeitpunkt eines Handoffs wird erst nach Bestätigung der Vorschau gesetzt, unmittelbar vor dem Speichern. Auch Session-Änderungszeit und neue Anki-Entwürfe erhalten diesen Zeitpunkt. Eine länger geöffnete Vorschau datiert den Import dadurch nicht mehr zurück. Abbrechen und identischer Wiederholungsimport verändern keinen gespeicherten Zeitstempel. Bereits gespeicherte Importzeiten bleiben bestehen; der damalige Bestätigungszeitpunkt lässt sich nicht nachträglich rekonstruieren.

Das Datenformat ist gegenüber 2.1.0 unverändert.

## Update von 2.0 / 2.0.1 / 2.1.0

1. Noch offene Formularänderungen speichern und ein JSON-Backup exportieren.
2. Den **Inhalt** des ZIP-Ordners `readwise-workbench-2` in dein **bestehendes Workbench-2-Repository** übernehmen. Insbesondere `index.html`, `sw.js` und `manifest.webmanifest` ersetzen; `icons/` beibehalten.
3. Dieselbe App-Adresse verwenden. Alle App-Tabs und installierten App-Fenster schließen, wieder öffnen; bei noch alter Anzeige nach dem Laden des Updates nochmals schließen und öffnen. Links unten muss **v2.1.1** stehen.
4. **Alle Geräte vor dem nächsten Gist-Abgleich aktualisieren.** Beim Wechsel von 2.0.x enthält der neue Stand zusätzliche Felder, die 2.0.x nicht lesen kann. 2.1.0 und 2.1.1 haben dasselbe Datenformat.
5. Browserdaten nicht löschen. Bestehende Kandidaten, Sessions, Handoffs, Anki-Karten und Verbindungen bleiben erhalten.

Der bisherige lokale Namensraum und die Gist-Datei bleiben bestehen. 2.0-Daten werden beim Laden ergänzt, mit einem lokalen Recovery-Stand vor der Umstellung. Alte Sessions erhalten den bisherigen Anki-Workflow mit einer neutralen Standardvorlage; ihre Quellen, Zwischenstände, Entscheidungen und Karten bleiben unverändert. Ein alter Prompt war in 2.0 nicht pro Session gespeichert: seine genaue frühere Textfassung lässt sich nicht rekonstruieren. Unbekannte historische Importzeiten bleiben unbekannt. 1.x-Backups werden nicht automatisch importiert.

## Neu

- **Notion / flexibel · ohne AnkiConnect** als Standard für neue Sessions. Ablage für späteres Lernen, Sprintnotiz, Aufgabe, Reflexion, Schreiben oder ein frei gewähltes Ziel. Keine verpflichtende Feynman-Runde bei der Inbox-Verarbeitung.
- **Dialog + AnkiConnect** bleibt auswählbar. Eigene Verarbeitung, Kartenentwurf, App-Review, Freigabe und bestätigter Anki-Write.
- **Persönliche Vorlagen** unter Einstellungen → Workflows & eigene Prompts. Öffentliche Vorgaben enthalten keine persönliche Notion-Sammlung.
- **Festgehaltene Vorlagen pro Session:** Änderungen gelten für danach gestartete Sessions. Bereits begonnene Sessions behalten ihre Fassung.
- **Offenes Handoff 2.1:** freie Routen, mehrere Aktionen, beliebige zusätzliche JSON-Felder. Technische Zuordnung, Ergebnisstatus und Anki-Pflichtfelder bleiben geprüft. Handoffs 2.0 werden weiterhin unterstützt.
- **Verarbeitungsprotokoll:** alle gespeicherten Runden, Quellsnapshot, Aktionen, Ergebnisse, eigene Gedanken und Zusatzfelder. Suchbar und als JSON exportierbar.
- Bestehende vier Sortierungen und Anki-Bestandserkennung bleiben erhalten.

## Ein Highlight durch den neuen Ablauf schicken

1. Im Eingang ein Highlight auswählen. Workflow **Notion / flexibel** wählen → Verarbeitung beginnen.
2. **Prompt 1 kopieren** und in einen neuen Chat einfügen. Dieser braucht Zugriff auf das Zielsystem, wenn er dort schreiben soll. Das Ziel und deine persönlichen Regeln im Gespräch nennen oder vorher in der Vorlage hinterlegen.
3. Entscheiden, was mit dem Highlight geschehen soll. Eine erfolgreiche Ablage in eine Lernsammlung reicht als Verarbeitung. Auch mehrere sinnvolle Verwendungen sind möglich.
4. Für Gerätewechsel den Zwischenstand und optional den Chat-Link speichern; Gist abgleichen. Auf dem zweiten Gerät zuerst abgleichen, dann dieselbe Session fortsetzen. Der vollständige Chatverlauf wird nicht automatisch übertragen.
5. Nach erfolgter Verarbeitung **Prompt 2** in denselben Chat schicken. Er bilanziert die Ergebnisse und führt keine neuen Writes aus.
6. JSON in der App einfügen → **Prüfen & übernehmen** → Vorschau prüfen und bestätigen.
7. Im **Verlauf** die Aktionen und Ergebnislinks ansehen. Bei Notion-Verarbeitung ist kein Laptop-/Anki-Schritt nötig. Späteres Lernen läuft im Zielsystem.

Die App prüft Datenstruktur und Referenzformat. Ob ein externer Write wirklich stattgefunden hat, muss im Chat beziehungsweise am tatsächlichen Ziel überprüft werden.

## Eigene Prompts

Beide Workflows haben einen editierbaren Startprompt und einen Handoff-Zusatz. Beim Speichern wird nichts veröffentlicht. Texte liegen in deinem lokalen State und werden beim manuellen Gist-Abgleich verschlüsselt mitgenommen. Klartext-Backups enthalten sie ebenfalls. Zugangsdaten ausschließlich in die Verbindungsfelder eintragen.

Verfügbare Variablen:

| Variable | Inhalt |
|---|---|
| `{{COUNT}}` | Anzahl der Highlights |
| `{{SESSION_ID}}` | Feste Session-ID |
| `{{WORKFLOW}}` | Gewählter Workflow |
| `{{HIGHLIGHTS_JSON_OR_MARKDOWN}}` | Highlight-IDs, Quellen, alte Zuordnungen und frühere Ergebnisse als JSON |
| `{{CHECKPOINT}}` | Gespeicherter Zwischenstand |
| `{{CHAT_URL}}` | Gespeicherter Chat-Link |
| `{{HANDOFF_SCHEMA}}` | Rückgabevertrag einschließlich aktueller IDs |

Fehlt die Highlight-Variable, ergänzt die App die Daten im Startprompt. Der Handoff-Vertrag und die ID-Zuordnung werden in Prompt 2 immer mitgeliefert. Quellen werden bei der Ersetzung nicht als weitere Vorlage ausgewertet.

„Neutrale Vorlagen laden“ füllt nur einen Formularentwurf; erst Speichern ersetzt die persönliche Vorlage. Ungespeicherte Änderungen blockieren den Sync und den Start einer Session mit ungespeicherten Vorlagen.

## Verarbeitungsprotokoll und Status

Die Readwise-ID ist die Identität. Jede bilanzierte Session erzeugt logisch einen Protokolleintrag pro Highlight; mehrere Verwendungen in einem Durchgang stehen in dessen Aktionen. Erneutes Aufgreifen fügt eine neue Runde hinzu. Alte Ergebnisse bleiben sichtbar.

Das Protokoll wird aus den dauerhaft gespeicherten Handoffs abgeleitet; es gibt keine zweite, auseinanderlaufende Kopie. Der Export enthält die gefilterte Auswahl, einschließlich Quellsnapshot, freier Daten und zusätzlicher Handoff-Metadaten.

- `processed_at`: vom Chat tatsächlich bekannter Verarbeitungszeitpunkt, sonst Session-`completed_at`, sonst unbekannt.
- `imported_at`: tatsächlicher Importzeitpunkt in der App; bei Altbestand unbekannt.
- Das Startdatum einer Session wird nicht als Verarbeitungszeit ausgegeben.
- Derselbe Handoff-Import ist ein No-op. Ein abweichendes zweites Handoff derselben Session wird nicht still überschrieben.
- Für Anki bleibt der Status ausstehend, bis eine bestätigte Note-ID vorliegt.
- Eine erledigte Aktion ohne externes Artefakt kann mit einer konkreten Beschreibung protokolliert werden. Bloß geplante oder gescheiterte Aktionen gelten nicht als vollständig verarbeitet.

## Verbindungen

**Readwise:** Token und Importbeginn in Einstellungen speichern. Neue Highlights ab diesem Datum werden ohne Workflow-Tag aufgenommen; ältere über das exakte Tag `Workbench`. Andere Tags sind Kontext. Die vorhandene Export-Paginierung, inkrementelle Abfrage mit Überschneidung und wöchentlicher Vollabgleich bleiben erhalten. Kein Readwise-Write.

**Gist:** Bestehenden geheimen Gist, Token und Passphrase weiterverwenden. Dateiname bleibt `readwise_workbench_v2.json`. Neues Gerät zuerst abgleichen, bevor dort eigene Daten oder Vorlagen angelegt werden. Gerät A speichern → abgleichen → Gerät B abgleichen → weiterarbeiten. Der manuelle Dreiwege-Abgleich umfasst auch die zwei Vorlagensätze; gleichzeitige Änderungen derselben Vorlage werden als Konflikt vorgelegt. Nicht gleichzeitig an derselben Session arbeiten.

Tokens, Endpunkte, Theme, gewählte Ansicht und die Auswahl des nächsten Workflows bleiben lokal. Die Passphrase bleibt nur im Tab. Lokale Daten und JSON-Backups sind unverschlüsselt; Gist-Inhalt ist zusätzlich verschlüsselt. Der Gist-Abgleich ist keine atomare Mehrbenutzer-Schreibsperre.

**AnkiConnect:** Anki Desktop auf demselben Gerät, typischer Endpunkt `http://127.0.0.1:8765`. Bestehendes Deck und Notiztyp weiterverwenden. Benötigte Felder: Frage, Antwort, Zitat, Notizen, Medien; Tags werden als Anki-Tags übergeben. Optionale eigene Erklärung/Eselsbrücke gelangen ohne separates Feldmapping in Notizen.

In AnkiConnect `webCorsOriginList` den tatsächlichen App-Ursprung ohne Repository-Pfad erlauben, beispielsweise `https://exampleuser.github.io`. Bind-Adresse `127.0.0.1` belassen, danach Anki neu starten. Die App zeigt den genauen Ursprung in ihrer Verbindungshilfe. Bestehende Notizen werden über Readwise-Links erkannt und nicht überschrieben.

## Installation und Test

Bei einer Neuinstallation den Inhalt von `readwise-workbench-2` als statische Website mit HTTPS bereitstellen; `index.html` liegt im Website-Hauptverzeichnis. Relative Pfade unterstützen GitHub Pages. Installieren über das Browsermenü, soweit unterstützt.

Lokal: `python3 -m http.server 8080` und `http://localhost:8080/`. Nicht per `file://` öffnen. App-Shell funktioniert offline; externe Dienste benötigen Verbindung.

Tests (nur für Entwicklung; keine echten Accounts):

```bash
node --test tests/*.test.cjs
# Playwright und Chromium separat bereitstellen:
node tests/browser.cjs
```

Optional: `CHROMIUM_PATH` und `TEST_OUTPUT_DIR`. Details und Grenzen in `docs/ARCHITECTURE.md`, `docs/TESTING.md` und `docs/HANDOFF.md`.
