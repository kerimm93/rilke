# Architektur · 2.1.1

## Rolle

Workbench = Eingang, initiale Verwendung, Verarbeitungsprotokoll. Kein Lernplan, Recall-Dashboard oder SRS. Notion und andere Zielsysteme werden im externen Chat bearbeitet. Die Workbench importiert die Ergebnisbilanz. Anki bleibt ein separater, bestätigter App-Write.

## Persistenz und Kompatibilität

- Bestehende IndexedDB `readwise-workbench-2`, Config `rww2.config`, Ansicht `rww2.ui`, Fallback `rww2.fallback`.
- Stateformat `readwise-workbench-state-v2`, numerische Version 2. Neue Statefelder: `workflows[]`; je Session `workflow` (Vorlagensnapshot) und `handoff_imported_at`.
- `validateState` gibt einen validierten, normalisierten Clone zurück; ein altes Inputobjekt wird nicht verändert.
- Vorhandensein von `workflows` unterscheidet alten State von neuem. Nur alter State erhält fehlende Sessionfelder automatisch. Bei neuem State werden fehlende Snapshots als Fehler behandelt.
- Beim Boot vor dem Speichern der Migration lokales Recovery des alten Stands. Quellen, Karten, Handoff-Inhalte, IDs und Lerngeschichte werden nicht umgeschrieben.
- Alte Sessions erhalten die neutrale Anki-Vorlage. 2.0 hatte keine Prompt-Snapshots; die damalige genaue Textfassung ist nicht rekonstruierbar. Importzeit bleibt null, statt aus mutablem updated_at geraten zu werden.
- Backups 2.0/2.1 lesbar; neue Exporte 2.1. Alte App-Versionen lehnen neue Felder ab. Alle Geräte vor weiterer Nutzung des gemeinsamen Gists aktualisieren.
- Transaktionale IndexedDB-Write-Queue, Commit erst nach oncomplete; bei Speicherfehler keine Änderung am übernommenen In-Memory-State.
- Tokens und Endpunkte ausschließlich in lokaler Config, Passphrase ausschließlich im Tab. Persönliche Vorlagen sind Inhaltsdaten; Backup und lokaler State sind Klartext.

## Workflows und Vorlagen

Zwei feste Workflow-IDs, notion und anki. Pro Workflow frei editierbarer Startprompt und Handoff-Zusatz mit updated_at. Öffentliche Defaults enthalten keine persönliche Notion-URL.

Workflowwahl im Eingang ist lokale UI-Präferenz. newSession friert die ausgewählte Vorlage und Quellen ein. Spätere Änderungen an den globalen Vorlagen beeinflussen die Session nicht. Zwischenstand bleibt separat editierbar.

Ersetzung per einzelnem Regex-Durchlauf und Callback: eingebettete Quellen werden nicht erneut als Template interpretiert. Fehlende Eingabe-Variable führt zur automatischen Ergänzung. Handoff-Vertrag und erwartete IDs werden immer angefügt. Der Notion-Workflow verlangt anki:null.

## Protokoll

Dauerhafte Quelle des Protokolls sind die Handoffs aller Sessions. Eine abgeleitete Zeile je Session und Highlight:

- stabile event_id aus Session-ID und Highlight-ID;
- Readwise-ID, generation, Workflow;
- tatsächliche Verarbeitung laut Handoff, Importzeit der App und separat Sessionstart;
- eingefrorene Quelle;
- komplettes Handoff-Item samt beliebigen Zusatzfeldern;
- Root-/Session-/Summary-Metadaten des Handoffs;
- aktueller Anki-Status als zusätzliche Information.

Keine zweite synchronisierte Logkopie. Wiederholter identischer Import ist No-op; erneutes Aufgreifen erzeugt eine weitere Session, alte Ergebnisse bleiben erhalten. Die UI hat keine Session-Löschfunktion. Ein ausdrücklich ersetzendes Backup kann wie bisher einen älteren Gesamtstand wiederherstellen; davor wird Recovery gespeichert.

Die Vorschau validiert das Handoff und erkennt Wiederholungsimporte, ohne den Import vorzubereiten. Erst nach erfolgreichem `ask(...)` ruft sie `applyHandoff(...)` unmittelbar vor `commit(...)` auf. `handoff_imported_at`, Session-`updated_at` und Zeitstempel neuer Karten erhalten denselben Bestätigungszeitpunkt. Bei Speicherfehler bleiben State und Handoff-Entwurf erhalten; ein neuer Versuch erhält seinen eigenen Bestätigungszeitpunkt.

Suche und JSON-Export arbeiten auf dem gesamten Protokoll. Anzeige von Zusatzfeldern als escaptes JSON; Inhalte werden nicht als HTML oder Code ausgeführt.

## Handoff

Typ `readwise-workbench-handoff-v2`, akzeptierte Versionen 2.0 und 2.1. Neue Prompts erzeugen 2.1. Pflichtkern: genaue Sessionzuordnung, vollständige eindeutige Highlightmenge, definierte Outcomes und konsistente Standardzähler.

route ist freier Text. user_processing erlaubt freie Felder und {}. actions ist optional, verlangt je Aktion nur description und status completed/planned/failed; andere Daten werden erhalten. artifacts erlaubt freie System-/Ziel-/Aktionsnamen bei tatsächlicher HTTP(S)-Referenz, für Notion mit Notion-Host.

Unbekannte Felder auf allen Handoff-Ebenen werden gespeichert und exportiert. Bekannte technische Felder bleiben typisiert. Anki behält seine Pflichtfelder; zusätzliche Metadaten werden erhalten. Einzelkarte und Kartenliste dürfen nicht gemischt werden.

processed benötigt Ergebnisreferenz, erledigte Aktion oder vollständigen Anki-Payload. Unfertige Aktionen verhindern processed, fehlgeschlagene Aktionen verlangen error. Fehler enthalten notes und errors. discarded enthält keine erledigten Aktionen/Artefakte/Karten. deferred enthält keinen Anki-Write.

Keine automatische Notion-Verifikation durch die App: die Importvorschau verlangt eine Prüfung der tatsächlich erfolgten Aktionen. Keine erneute Ausführung von Handoff-Aktionen.

## Sync

Bestehender manueller AES-GCM-Gist-Abgleich, Datei `readwise_workbench_v2.json`. PBKDF2-SHA256 mit 250000 Iterationen, zufälliges Salt und IV. Keine neue Sync-Infrastruktur.

Dreiwege-Merge pro Kandidat, kompletter Session und jetzt pro Workflow-Vorlage. Gemeinsame Basis BASE bleibt lokal. Gleichzeitige Änderungen erfordern Entscheidung; kein stilles Last-Write-Wins. Legacy-BASE und Remote werden gleich normalisiert, damit die Migration keine Scheinkonflikte erzeugt.

Ein ansonsten leeres Gerät mit eigenen Vorlagen gilt nicht als leer und wird nicht still durch einen fremden Workspace ersetzt. Frische Geräte zuerst laden.

Tombstones, konservative Checkpoints, Recovery vor ersetzender Übernahme, Preflight vor PATCH, Readback danach, echte No-op ohne PATCH bleiben erhalten. Gekürzte Gist-Inhalte werden vollständig über geprüfte raw_url nachgeladen, ohne GitHub-Token an den Raw-Host weiterzugeben.

Grenze: Preflight und Readback sind kein atomarer Compare-and-Swap. Eng gleichzeitige Writes sind nicht garantiert verlustfrei. Vorgesehene Nutzung: sequentieller Gerätewechsel und Backups.

## Anki und PWA

Anki-Adapter bleibt: Feldprüfung, Recovery-Suche per stabiler Karten-ID, aktuelle Suche nach Readwise-ID, ausdrückliche Zusatzkartenfreigabe, addNote, bestätigte Note-ID, lokale Speicherung. Existierende Notizen werden nicht überschrieben; gespeicherte Note-IDs und Kartenhistorie bleiben erhalten. Quelltext/Notiz/Link werden bewahrt und HTML-escaped.

PWA: pfadgebundener App-Shell-Cache, Version 2.1.1, relative Pfade. Keine API-/Fremd-Origin-/State-Caches, kein Background-Sync, kein automatischer Wechsel mitten in einer laufenden Session.

## Technische Referenzen

Bestehende Implementierung und Projektvorgaben KERIM APP SYSTEM v3, Gist-Sync Referenz v2, GitHub-Sync Best Practices. API-Adapter wurden in diesem Update nicht neu entworfen. Kein Framework, kein Build-Step, kein neues Notion-Schema.
