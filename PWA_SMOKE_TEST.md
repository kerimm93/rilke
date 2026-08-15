# Rilke: PWA- und Offline-Smoke-Test

## Testumgebung und Protokoll

Die App über **HTTPS** (zum Beispiel GitHub Pages) oder `localhost` bereitstellen. `file://` ist keine Service-Worker- oder PWA-Testumgebung. Vor dem Test ein Rilke-Recovery-ZIP erstellen und Browser, Betriebssystem, URL, Datum sowie beobachtetes Ergebnis notieren. Nur tatsächlich reproduzierte Schritte als bestanden markieren.

Für einen lokalen Test im Repository-Root kann beispielsweise folgender statischer Server verwendet werden:

```text
python3 -m http.server 8000
```

Danach `http://localhost:8000/` öffnen.

## 1. Installation

- [ ] App online öffnen und vollständig laden.
- [ ] DevTools → Application prüfen: `manifest.json` wird ohne Fehler erkannt.
- [ ] Manifest zeigt Name `Rilke`, Start-URL und Scope relativ zur aktuellen Repository-URL.
- [ ] Beide PNG-Icons (192×192 und 512×512) werden erkannt.
- [ ] `sw.js` ist für den aktuellen Repository-Subpfad registriert.
- [ ] Browser bietet die Installation an oder bestätigt die Installierbarkeit.
- [ ] App installieren und aus dem App-/Startmenü öffnen.
- [ ] Die App startet im Standalone-Fenster ohne normale Browser-UI.

## 2. Offline-App und IndexedDB

- [ ] App mindestens einmal online laden und warten, bis der Service Worker installiert ist.
- [ ] Eine eindeutig benannte Testkarte online anlegen und den gespeicherten Zustand prüfen.
- [ ] Netzwerk in DevTools auf `Offline` stellen.
- [ ] Alle Rilke-Fenster schließen und die installierte App erneut öffnen.
- [ ] Die Rilke-App-Shell ist sichtbar; keine generische Browser-Fehlerseite erscheint.
- [ ] Die zuvor gespeicherte IndexedDB-Karte ist sichtbar.
- [ ] Eine zweite, eindeutig benannte Karte offline erstellen.
- [ ] App neu laden.
- [ ] Die offline erstellte Karte ist weiterhin vorhanden.
- [ ] DevTools → Application → IndexedDB bestätigt weiterhin `rilke_db_v1`, Version 1.

## 3. Offline-ZIP mit lokalem JSZip

- [ ] Nach der erfolgreichen Online-Initialisierung eine frische App-Sitzung öffnen.
- [ ] Netzwerk auf `Offline` stellen.
- [ ] In den Speicher-Einstellungen `ZIP-Backup exportieren` auslösen.
- [ ] Im Network-Panel kommt `vendor/jszip-3.10.1.min.js` aus dem Service-Worker-/Cache-Pfad und es gibt keinen jsDelivr-Request.
- [ ] Das ZIP wird erfolgreich heruntergeladen und lässt sich öffnen.
- [ ] `manifest.json`, `state/S.json` und die erwarteten Markdown-Dateien sind im Backup vorhanden.
- [ ] Optional den Markdown-ZIP-Export ebenfalls offline ausführen.

## 3a. App-Shell-Cache gegen andere Navigationen schützen

- [ ] Netzwerk aktivieren und die App am Repository-Root beziehungsweise über `index.html` laden.
- [ ] `PWA_SMOKE_TEST.md` direkt in der Adresszeile öffnen und eine erfolgreiche Markdown-Antwort bestätigen.
- [ ] `manifest.json` direkt in der Adresszeile öffnen und eine erfolgreiche JSON-Antwort bestätigen.
- [ ] Zur Rilke-App zurückkehren, warten bis alle Navigationen abgeschlossen sind und das Netzwerk auf `Offline` stellen.
- [ ] Alle Rilke-Fenster schließen und die installierte App beziehungsweise den Repository-Root erneut öffnen.
- [ ] Die Offline-App zeigt weiterhin Rilkes `index.html`, nicht Markdown aus `PWA_SMOKE_TEST.md` und nicht JSON aus `manifest.json`.
- [ ] Ergänzend in DevTools prüfen: Direkte Navigationen zu anderen same-origin Dateien erhalten kein `respondWith()` vom Worker und überschreiben den festen App-Shell-Cache-Key nicht.

## 3b. Statischen Cache-Miss bei aktivem Worker prüfen

- [ ] Netzwerk aktivieren und bestätigen, dass der Service Worker weiterhin registriert und aktiv ist.
- [ ] In DevTools → Application → Cache Storage ausschließlich `rilke-app-v1` leeren oder löschen; den Worker nicht abmelden.
- [ ] Die App neu laden und `ZIP-Backup exportieren` auslösen.
- [ ] Der Cache-Miss für `vendor/jszip-3.10.1.min.js` wird über das Netzwerk beantwortet; es tritt kein `ReferenceError` im Service Worker auf.
- [ ] JSZip wird anschließend wieder im aktuellen Rilke-App-Cache abgelegt und das ZIP erfolgreich erzeugt.
- [ ] Optional denselben Cache-Miss mit einem Icon oder `manifest.json` prüfen: Die Netzwerkantwort wird an den Browser zurückgegeben und danach wiederverwendet.
- [ ] Optional in DevTools einen Cache-Schreibfehler simulieren oder per automatisiertem Test abdecken: Die erfolgreiche Netzwerkantwort bleibt trotzdem nutzbar.

## 4. Offline-Gist-Sync

- [ ] Vorher lokalen State, letzte bestätigte Revision und Fingerprint dokumentieren.
- [ ] Netzwerk bleibt `Offline`; den manuellen Gist-Sync starten.
- [ ] Die UI zeigt einen echten Netzwerk-/Remote-Fehler und keine Remote-Übernahme aus einem Cache.
- [ ] Im Cache Storage liegt keine Antwort von `api.github.com`, `gist.githubusercontent.com` oder einer anderen Cross-Origin-Quelle.
- [ ] Lokale Karten, Fingerprint-/Revisions-Baseline und Pending-Revisionen bleiben gemäß bestehender Fehlersicherheit unverändert.
- [ ] Es startet kein automatischer Folgesync bei Offline-/Online-Wechsel.

## 5. Wieder online

- [ ] Netzwerk wieder aktivieren.
- [ ] Beobachten: Es startet kein automatischer Gist-Sync.
- [ ] Den Gist-Sync manuell auslösen.
- [ ] Sichtbarer Laufstatus, deaktivierte Sync-Aktionen und Ergebnisdetails funktionieren wie in `SYNC_SMOKE_TEST.md` beschrieben.
- [ ] Der tatsächliche Remote-Stand wird vom Netzwerk gelesen; keine GitHub-/Gist-Antwort stammt aus Cache Storage.

## 6. Worker-Update und Cache-Cleanup

1. **Version A vorbereiten**
   - [ ] Mit `CACHE_NAME = 'rilke-app-v1'` online laden.
   - [ ] Eine eindeutig benannte Karte anlegen und Reload-Persistenz prüfen.
   - [ ] In Cache Storage `rilke-app-v1` dokumentieren.
   - [ ] Optional einen eindeutig fremden Cache anlegen oder vorhandenen fremden Cache-Namen dokumentieren.

2. **Version B bereitstellen**
   - [ ] Eine sichtbare, rein statische Teständerung vornehmen.
   - [ ] In `sw.js` ausschließlich für den Test `CACHE_NAME` auf `rilke-app-v2` erhöhen.
   - [ ] Version B ausliefern und online neu laden.
   - [ ] DevTools zeigt den neuen Worker zunächst gegebenenfalls als `waiting`; eine laufende Sitzung wird nicht per `skipWaiting()` übernommen.

3. **Normalen Lifecycle abschließen**
   - [ ] Alle von Version A kontrollierten Rilke-Tabs und App-Fenster schließen.
   - [ ] Rilke erneut öffnen; Version B ist jetzt aktiv.
   - [ ] `rilke-app-v1` wurde entfernt und `rilke-app-v2` ist vorhanden.
   - [ ] Fremde Cache-Namen wurden nicht gelöscht.
   - [ ] Die unter Version A angelegte IndexedDB-Karte ist weiterhin vorhanden.
   - [ ] `localStorage`-Konfiguration und Sync-Baselines sind weiterhin vorhanden.
   - [ ] Einen manuellen Gist-Sync ausführen und das Ergebnis prüfen.

4. **Teständerung zurücksetzen**
   - [ ] Die absichtliche sichtbare Teständerung entfernen.
   - [ ] Den für die tatsächlich auszuliefernde Version vorgesehenen Cache-Namen beibehalten und erneut prüfen.

## Erwartete Invarianten

- IndexedDB-Name und Version bleiben unverändert: `rilke_db_v1`, Version 1.
- Der Service Worker enthält keine IndexedDB-, `localStorage`-, Gist-Sync-, Background-Sync- oder Push-Logik.
- Cache Storage enthält nur statische, explizit bekannte Rilke-App-Ressourcen.
- Nur Navigationen zum Repository-Root oder zu `index.html` nutzen online die aktuelle Antwort und offline die letzte erfolgreich gecachte `index.html`.
- Direkte Navigationen zu anderen same-origin Ressourcen wie `PWA_SMOKE_TEST.md` oder `manifest.json` werden nicht vom Worker übernommen und können den App-Shell-Cache nicht überschreiben.
- Bei einem Cache-Miss eines explizit erlaubten statischen Assets wird die erfolgreiche Netzwerkantwort auch nach dem Cache-Schreibversuch an den Browser zurückgegeben.
- GitHub-/Gist- und sonstige Cross-Origin-Requests werden vom Service Worker nicht mit `respondWith()` übernommen.
- Der verschlüsselte Gist-Sync bleibt ausschließlich manuell.

## Ergebnisprotokoll

```text
Datum:
Browser / Version:
Betriebssystem:
Test-URL:
Installation:
Offline-App:
Offline-ZIP:
Offline-Gist:
Wieder online:
Worker-Update:
Abweichungen / offene Punkte:
```
