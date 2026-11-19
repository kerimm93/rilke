# Rilke: Zwei-Browser-Sync-Smoke-Test

## Testumgebung und Protokoll

Verwende zwei getrennte Browserprofile oder zwei Browser: **Browser A** und **Browser B**. Beide erhalten dieselbe Gist-ID, dasselbe GitHub-Token und dieselbe Passphrase, aber unterschiedliche Gerätenamen. Exportiere **vorher in beiden Browsern ein Recovery-ZIP**. DevTools dürfen Revisionen und Requests ergänzend kontrollieren, ersetzen aber nie die sichtbare UI-Prüfung.

Für jeden Fall Datum, Browser, tatsächlich beobachtetes Datenresultat, Ergebnistext, Control-Zustand und einen Folgesync-Hinweis protokollieren. Während jedes Laufs müssen „Sync läuft“, Phase, Startzeit und Bearbeitungssperre sichtbar sowie Gist-ID, Token, Passphrase, Merken-Checkbox, Gerätename und beide Sync-Buttons deaktiviert sein. Der Schließen-Button bleibt aktiv. Nach jedem Ende sind die Controls wieder aktiv. Als „getestet“ nur reproduzierte Schritte markieren.

## Testfälle

### 1. Erstinitialisierung und gemeinsamer Ausgangsstand
- **Vorbereitung:** Definiert leeres Gist oder dokumentierten Ausgangsstand wählen; beide lokalen Stände dokumentieren.
- **Aktion:** A initialisiert manuell, danach synchronisiert B.
- **Daten:** Gemeinsamer Stand und bestätigte Baselines; keine Datenverluste.
- **Anzeige:** A zeigt Upload (oder beim wirklich leeren, uninitialisierten Stand einen Hinweis), B Remote-Übernahme beziehungsweise echten No-Op; niemals eine falsche Merge-Behauptung.
- **Controls/Folgesync:** Sperre nur während des Laufs; danach aktiv, kein Folgesync bei bestätigtem Stand.

### 2. Neue Karte nur in Browser A
- **Vorbereitung:** Gemeinsamer No-Op-Ausgangsstand.
- **Aktion:** Karte in A anlegen und A synchronisieren.
- **Daten:** Karte lokal und verschlüsselt remote vorhanden.
- **Anzeige:** „Lokal hochgeladen“ bleibt nach Toast und erneutem Öffnen sichtbar.
- **Controls/Folgesync:** Währenddessen gesperrt, danach aktiv; kein Folgesync.

### 3. Danach Browser B synchronisieren
- **Vorbereitung:** Fall 2 abgeschlossen; Karte fehlt noch in B.
- **Aktion:** B synchronisieren.
- **Daten:** Karte erscheint unverändert in B.
- **Anzeige:** Remote-Übernahme, nicht Upload oder Merge.
- **Controls/Folgesync:** Lauf-Sperre, danach aktiv; nur bei angezeigter lokaler Wartung Folgesync.

### 4. No-Op-Konvergenz
- **Vorbereitung:** Beide enthalten denselben bestätigten Stand.
- **Aktion:** A und B ohne Änderung synchronisieren; optional Gist-History vorher/nachher vergleichen.
- **Daten:** Unverändert.
- **Anzeige:** Beide zeigen No-Op dauerhaft.
- **Controls/Folgesync:** Danach aktiv, kein Folgesync; keine neue Gist-Revision/kein unnötiger PATCH.

### 5. Gleichzeitig unterschiedliche neue Karten
- **Vorbereitung:** Gemeinsamer Ausgangsstand; Netzwerk noch nicht zum gegenseitigen Sync nutzen.
- **Aktion:** Karte A nur in A und Karte B nur in B erstellen.
- **Daten:** Beide lokalen Karten vorerst getrennt vorhanden.
- **Anzeige:** Noch kein neuer Sync-Endstatus bis zum nächsten Lauf.
- **Controls/Folgesync:** Bearbeitung vor dem Sync aktiv.

### 6. Beide Browser nacheinander synchronisieren
- **Vorbereitung:** Fall 5.
- **Aktion:** A und B eng nacheinander manuell synchronisieren.
- **Daten:** Konservatives Zusammenführen; keine Karte geht verloren.
- **Anzeige:** Tatsächliche Richtung als Upload, Merge-synchronisiert oder lokaler Merge; bei konkurrierendem Stand verständlicher Hinweis.
- **Controls/Folgesync:** Lauf-Sperre; bei lokalem, noch nicht bestätigtem Merge sichtbarer Folgesync.

### 7. Weitere Syncs bis gemeinsamer No-Op-Stand
- **Vorbereitung:** Ergebnis aus Fall 6.
- **Aktion:** Abwechselnd synchronisieren, bis beide einen No-Op melden.
- **Daten:** Beide Browser enthalten beide Karten identisch.
- **Anzeige:** Letzter dauerhafter Status ist in beiden Browsern No-Op.
- **Controls/Folgesync:** Aktiv nach jedem Lauf; am Ende kein Folgesync.

### 8. Einseitige Kartenänderung
- **Vorbereitung:** Gemeinsamer No-Op-Stand.
- **Aktion:** Vorhandene Karte nur in A ändern, A syncen, danach B syncen.
- **Daten:** Änderung wird remote bestätigt und in B übernommen.
- **Anzeige:** A Upload, B Remote-Übernahme (oder der tatsächlich durch Konkurrenz erforderliche Pfad), keine falsche Merge-Aussage.
- **Controls/Folgesync:** Lauf-Sperre; nach sauberer Übernahme kein Folgesync.

### 9. Beidseitige Änderung derselben Karte
- **Vorbereitung:** Recovery-ZIPs erneuern; gleiche Karte in A und B verfügbar.
- **Aktion:** Karte abweichend in beiden Browsern ändern und Sync versuchen.
- **Daten:** Konservative Blockade, kein stiller Gewinner; beide lokalen Fassungen bleiben erhalten.
- **Anzeige:** Dauerhafter Fehler mit Merge-/Konfliktphase, keine Erfolgsaussage.
- **Controls/Folgesync:** Nach Fehler wieder aktiv; Fehlerstatus statt Folgesync-Ersatz.

### 10. Reload zwischen Syncs
- **Vorbereitung:** Erfolgreiches Ergebnis erzeugen.
- **Aktion:** Seite neu laden, Settings öffnen; außerdem Settings vorher schließen/öffnen.
- **Daten:** Inhalt unverändert.
- **Anzeige:** Letztes Ergebnis samt Zeit und Details bleibt sichtbar.
- **Controls/Folgesync:** Nach abgeschlossenem Lauf aktiv; persistierter Folgesync-Hinweis bleibt gegebenenfalls sichtbar.

### 11. Zeitlich nahe Syncs
- **Vorbereitung:** Je eine lokale Änderung und frische Recovery-ZIPs.
- **Aktion:** Sync in A und B möglichst eng nacheinander starten.
- **Daten:** Keine unbekannte Revision wird still ignoriert; `successor`, `sibling` oder Revisions-Reconciliation bewahrt Daten.
- **Anzeige:** Verständliche Remote-Übernahme, Merge- oder Folgesync-Kategorie statt technischer Kind-Bezeichnung.
- **Controls/Folgesync:** Pro Browser währenddessen gesperrt; Hinweis bleibt sichtbar, falls Bestätigung aussteht.

### 12. Pending-Revision-/Folgesync-Hinweis
- **Vorbereitung:** Soweit reproduzierbar konkurrierende Revision erzeugen und Pending-Metadatum ergänzend prüfen.
- **Aktion:** Nächsten manuellen Sync ausführen.
- **Daten:** Pending-Liste erst nach erfolgreicher Verarbeitung entfernt; bei Fehler erhalten.
- **Anzeige:** Zu Beginn Pending-Anzahl, nach Erfolg Anzahl „verarbeitet“; stärkere Endkategorie bleibt primär.
- **Controls/Folgesync:** Lauf-Sperre; Folgesync nur, wenn der resultierende lokale Stand nicht remote bestätigt ist. Nicht reproduzierte Varianten als **offen**, nicht als bestanden markieren.

### 13. Falsche Passphrase
- **Vorbereitung:** Recovery-ZIP; gemerkte Passphrase vorübergehend deaktivieren/ersetzen.
- **Aktion:** Falsche Passphrase eingeben und Sync starten.
- **Daten:** Lokaler State und Baseline unverändert.
- **Anzeige:** Sofort Laufstatus, danach dauerhafter Fehler mit Entschlüsselungsphase und sicherer Meldung; nach Modal/Toast und Reload sichtbar.
- **Controls/Folgesync:** Sofort gesperrt, nach Fehler vollständig aktiv; keine Erfolgsaussage.

### 14. Netzwerk-/API-Fehler
- **Vorbereitung:** Recovery-ZIP; Netzwerk offline schalten oder absichtlich ungültige Zugriffskonfiguration verwenden, ohne produktive Credentials zu protokollieren.
- **Aktion:** Sync starten.
- **Daten:** Lokaler State und bestätigte Baseline bleiben erhalten.
- **Anzeige:** Dauerhafter Fehler mit passender Remote-/Konfigurationsphase, keine Erfolgsaussage.
- **Controls/Folgesync:** Während Lauf gesperrt, danach aktiv; Fehlerstatus ist maßgeblich.

## Gezielte Review-Regressionen

### Gist-ID-Wechsel im geöffneten Modal
1. Ein persistiertes Ergebnis im geöffneten Settings-Modal anzeigen lassen.
2. Nur die Gist-ID ändern und „Sync-Einstellungen speichern“ wählen.
3. Ohne Schließen des Modals muss sofort „Noch kein Sync-Ergebnis auf diesem Gerät.“ erscheinen; Eingabewerte und Fokus dürfen nicht durch ein Modal-Re-Render verloren gehen.
4. In DevTools ergänzend prüfen, dass `rilke_sync_ui_last_result_v1` entfernt wurde und die neue Gist-ID keinen Status des alten Ziels zeigt.
5. Bei „Sync jetzt“ muss der Idle-Zustand unmittelbar regulär durch „Sync läuft“ ersetzt werden.

### SID-Reparatur: Persistenz, Verwerfen und Rollback
1. Einen temporären Kandidaten mit SID-Reparatur erzeugen und anschließend verwerfen: Seine UID darf den Ergebniszähler nicht erhöhen.
2. Einen reparierten Kandidaten erfolgreich lokal persistieren: Der Endstatus muss die Reparatur genau einmal zählen, auch wenn dieselbe UID in weiteren überlebenden Wartungsmetadaten vorkommt.
3. Einen Merge-Kandidaten mit SID-Reparatur persistieren und danach einen Write-/Verify-Fehler mit erfolgreichem `rollbackLocal(pre)` auslösen: Die zurückgerollte Reparatur darf im Fehlerergebnis nicht erscheinen.
4. Eine Pending-Revision samt SID-Reparatur erfolgreich persistieren und danach einen unabhängigen Fehler ohne Rollback dieses Pending-Stands auslösen: Die erhaltene Reparatur muss weiterhin gezählt werden.

### Initiale SID-Reparatur und konkurrierendes Haupt-Merge-Ergebnis
1. **Sibling:** Haupt-Merge repariert SID A; anschließend entsteht `sibling`. Wenn der final persistierte `sib3` Ziel-SID A weiterhin enthält, muss A auch ohne erneute spätere Reparatur genau einmal in `sidRepairCount` erscheinen.
2. **Revision:** Haupt-Merge repariert SID A; anschließend entsteht `revision`. Wenn der final persistierte Reconciliation-Candidate Ziel-SID A weiterhin enthält, muss A auch ohne erneute spätere Reparatur genau einmal gezählt werden.
3. **Successor:** Soweit reproduzierbar prüfen, dass eine im geschriebenen Merge-State enthaltene Reparatur im übernommenen Successor genau einmal gezählt wird, sofern dessen finaler Candidate die Ziel-SID weiterhin enthält.
4. **Nicht überlebend:** Fehlt die Karte im finalen Candidate oder besitzt sie dort nicht mehr die reparierte Ziel-SID, darf die initiale Reparatur nicht gezählt werden.
5. **Rollback:** Ein erfolgreicher Rollback muss weiterhin sämtliche ausschließlich aus diesem Haupt-Merge stammenden Repair-Counts entfernen.

### Mehrere Pending-Revisionen mit überholter SID-Reparatur
1. Pending-Revision 1 repariert A auf Ziel-SID Y; eine spätere Pending-Revision verändert oder ersetzt den Candidate so, dass A im finalen Candidate nicht mehr Y besitzt. Nach erfolgreicher Persistierung darf diese Zwischenreparatur nicht gezählt werden.
2. Pending-Revision 1 repariert A auf Ziel-SID Y; spätere Pending-Revisionen lassen A auf Y bestehen. Nach erfolgreicher Persistierung muss A genau einmal gezählt werden.

### Leere Inhaltsstände mit unterschiedlicher Sync-Konfiguration
- **Vorbereitung:** A und B enthalten keine Karten, PairRelations, Kompositionen oder Tombstones; ein synchronisiertes allowlistetes Config-Feld unterscheidet sich, und Remote enthält den zu übernehmenden Wert.
- **Aktion:** Den Browser mit abweichender lokaler Konfiguration synchronisieren.
- **Erwartung:** Die Remote-Konfiguration wird lokal übernommen. Das dauerhafte Ergebnis ist `remote-adopted`, nicht `noop`, nennt die Remote-Konfigurationsübernahme und verlangt keinen Folgesync.
- **Zweiter Lauf:** Ohne weitere Änderung erneut synchronisieren. Nun sind die vollständigen Sync-States identisch; das dauerhafte Ergebnis ist ein echter `noop`.

### Pending-Laufstatus nach erfolgreicher Verarbeitung
- **Vorbereitung:** Mindestens zwei Pending-Revisionen liegen vor.
- **Aktion:** Manuellen Sync starten; während der Verarbeitung muss „2 Pending-Revision(en) zu verarbeiten“ sichtbar sein.
- **Unmittelbar nach erfolgreicher Pending-Verarbeitung:** Während der restliche Sync noch läuft, ist „zu verarbeiten“ verschwunden; stattdessen darf „2 Pending-Revision(en) verarbeitet“ erscheinen.
- **Endstatus:** Die verarbeitete Anzahl bleibt als Detail erhalten, es erscheint kein „zu verarbeiten“-Hinweis, und die fachliche Endkategorie des gesamten Laufs bleibt maßgeblich.

## Kartenkonflikte vergleichen und auflösen

Bei divergierenden Karten öffnet der manuelle Sync einen Vergleich mit lokaler Version, Gist-Version und, sofern verifiziert, dem Ausgangsstand aus der bestätigten Baseline. Die Ansicht zeigt Text, Kommentar, SID, Parent, Kinderliste, Reihenfolge, Status und weitere abweichende Felder einschließlich Zeitstempeln. Kartenreferenzen enthalten SID, Textanfang und UID.

Für jede Karte ist eine bewusste Entscheidung erforderlich. Lokale Version und Gist-Version übernehmen jeweils das vollständige Kartenobjekt. Beim Zusammenführen sind Text und Kommentar frei bearbeitbar, während Struktur und weitere Felder aus einer der beiden Versionen stammen. Die Kinderlisten werden anschließend aus den erhaltenen Karten und deren gewählten Parent-Beziehungen abgeglichen. Dadurch bleiben unabhängig hinzugefügte Unterkarten beider Instanzen erhalten. Zyklen und aktive Karten ohne aktiven Parent blockieren die Übernahme.

Entwürfe und die betroffenen Kartenpaare bleiben lokal in einzelnen IndexedDB-Datensätzen mit dem Präfix `cardConflictDraft:`. Die SHA-256-ID hängt von Gist, Revision und betroffenen Kartenpaaren ab. Ein Edit schreibt nur den aktuellen Entwurf. Nach erfolgreich abgeschlossenem Sync werden die verwendeten Entwürfe entfernt. Vorhandene Entwürfe aus `rilke_card_conflict_drafts_v1` werden transaktional nach IndexedDB migriert. Die alte Kopie wird nach erfolgreichem Import entfernt. Bei einem Importfehler bleibt sie für den nächsten Versuch erhalten. Sie werden weder synchronisiert noch in ZIP-Backups aufgenommen. Nach Abbruch oder Schreibfehler kann der Vergleich erneut geöffnet werden. Bei geänderten Ausgangsdaten lässt sich der Text eines früheren Entwurfs ausdrücklich laden und erneut vergleichen. Während der Ansicht sind gewöhnliche App-Änderungen durch die bestehende Sync-Sperre blockiert. Vor Übernahme werden zusätzlich der lokale Gesamtstand, Baseline, Sync-Zugangskonfiguration und die aktuelle Gist-Revision erneut geprüft. Der anschließende lokale Write prüft den erwarteten IndexedDB-Stand innerhalb derselben Schreibtransaktion. Dies schützt auch vor einem anderen Tab zwischen Vergleich und Commit.

Automatisierte Browserprüfung mit laufendem lokalem HTTP-Server und vorhandenem Playwright/Chromium ausführen.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# In einem zweiten Terminal, ebenfalls im Repository
node tests/card-conflicts-browser.cjs
```

Der Test verwendet zwei getrennte Browserkontexte mit eigener IndexedDB, echte Ver- und Entschlüsselung und eine simulierte Gist-HTTP-API. Er prüft Vergleich/Baseline, alle drei Entscheidungen, Entwurfswiederaufnahme nach Reload, Abbruch, veraltete lokale und entfernte Daten, IndexedDB- und Gist-Schreibfehler, fehlgeschlagene Entwurfsspeicherung, große Sammlungen bei vollem localStorage, wiederholte Edits, Migration und Bereinigung abgeschlossener Entwürfe, unabhängig hinzugefügte Unterkarten für alle drei Entscheidungen, konkurrierende IndexedDB-Writes vor und während der Übernahme, erneuten Sync und beidseitige No-op-Konvergenz. Die manuelle Abnahme gegen einen echten Gist gemäß den obigen Zwei-Browser-Testfällen bleibt zusätzlich erforderlich, um GitHub-Netzwerk- und Nebenläufigkeitsverhalten zu prüfen.
