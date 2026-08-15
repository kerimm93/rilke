# Rilke — Gedichtezettelkasten

**Rilke** ist eine lokal-first Single-File-HTML-App zur Arbeit mit poetischen Fragmenten, Gedichtkarten, Satzbausteinen, Relationen und Kompositionen.

Die App ist ein ruhiges Schreib- und Denkwerkzeug für eigene poetische Arbeit: ein digitaler Gedichtezettelkasten für Fragmente, Bilder, Metaphern, Satzkerne, Varianten und entstehende Kompositionen.

Rilke ist bewusst **kein Dashboard**, **kein Daily Log**, **kein klassisches PKM-System** und **keine Gamification-App**. Im Zentrum stehen Satz, Fragment, Karte und poetische Verdichtung.

---

## Grundidee

Rilke unterstützt einen einfachen poetischen Arbeitsfluss:

1. **Karten sammeln**
   Einzelne poetische Fragmente, Satzkerne oder Bilder werden als Karten gespeichert.

2. **Karten strukturieren**
   Karten können hierarchisch organisiert werden. Sichtbare Struktur-IDs wie `1`, `1.a` oder `1.a.1` helfen dabei, poetisches Material in einer Baumstruktur zu ordnen.

3. **Texte refactoren**
   Längere Texte können in kleinere Unterkarten aufgeteilt werden.

4. **Assoziationen entdecken**
   Im Brainstorm-Modus werden Karten organisch auf einer papierartigen Fläche ausgelegt. Nachbarschaften erzeugen Relationen zwischen Karten.

5. **Relationen weiterverarbeiten**
   Interessante Kartenbeziehungen können markiert, kommentiert und in neue Karten überführt werden.

6. **Kompositionen bauen**
   Karten können zu Kompositionen zusammengestellt, umsortiert und als Text exportiert werden.

---

## Features

### Karten-Modus

* Karten erstellen
* Karten bearbeiten
* Karten archivieren
* Parent-/Child-Struktur
* sichtbare Struktur-IDs
* Suche nach Text, Kommentar und SID
* Unterkarten und Schwesterkarten anlegen
* Text per Satz-Split in Unterkarten aufteilen
* Status pro Karte
* Kommentare, Tags, Links und Attachments als Datenfelder vorbereitet

### Brainstorm-Modus

* zufällige Auslage aktiver Karten auf einer papierartigen Fläche
* organischer Board-Look mit leichter Kartenstreuung
* unsichtbare Rasterlogik mit Wrap-Around-Nachbarschaft
* Fokuskarte erzeugt Relationen zu Nachbarkarten
* Relationen werden als `pairRelations` gespeichert
* interessante Relationen markieren
* Notizen zu Relationen speichern
* aus einer Relation neue Ideenkarten erzeugen

### Kompositions-Modus

* Kompositionen erstellen
* Karten zu Kompositionen hinzufügen
* Reihenfolge per Hoch-/Runter-Buttons ändern
* Textvorschau generieren
* Komposition als reinen Text kopieren
* Komposition mit Struktur-IDs kopieren

### Markdown-Export

* aktive Karten als Markdown exportieren
* ZIP-Export mit einzelnen Markdown-Dateien
* Dateinamen auf Basis der SID, z. B. `1.a.1.md`
* YAML-Frontmatter mit `uid`, `sid`, `status`, `tags`, `createdAt`, `updatedAt`
* Fallback auf einzelne Textdatei, falls ZIP-Erzeugung fehlschlägt

### Speicher-Settings

* sichtbare Speicheranzeige im Header
* aktueller Modus: lokaler Speicher
* geplanter Modus: Ordner-Modus später
* bestehende Speicherung bleibt vollständig lokal im Browser

---

## Technischer Aufbau

Rilke ist bewusst einfach gehalten:

* eine einzige HTML-Datei
* Vanilla JavaScript
* CSS direkt in der Datei
* kein Framework
* kein Backend
* kein Build-Step
* lokal-first
* Inhalts-State IndexedDB-first; `localStorage` nur für kleine Konfigurations- und Sync-Metadaten
* manueller, per AES-GCM verschlüsselter Gist-Sync (kein Auto-Sync)

Der zentrale App-State liegt in `S`.

```js
var S = {
  cards: [],
  pairRelations: [],
  compositions: [],
  matrixSessions: [],
  deletedIds: {},
  config: {
    appName: 'Rilke',
    matrixCols: 5,
    matrixRows: 4,
    exportMode: 'plain',
    storageMode: 'local'
  },
  _lastExported: ''
};
```

Der frühere, nur noch zur einmaligen Migration gelesene localStorage-Key ist:

```js
poem_zettelkasten_v1
```

---

## Lokale Nutzung

Die App kann direkt im Browser geöffnet werden.

```text
index.html öffnen
```

Der reine App-Betrieb über `file://` ist weiterhin möglich, aber **keine PWA-Testumgebung**: Manifest, Service Worker, Installation und Offline-App-Shell benötigen HTTPS oder `localhost`.

Für Entwicklung und PWA-Tests empfiehlt sich ein lokaler Server, zum Beispiel mit VS Code Live Server oder:

```text
python3 -m http.server 8000
```

Danach die App über `http://localhost:8000/` öffnen.

---

## Deployment über GitHub Pages

Die App kann als statische Website über GitHub Pages veröffentlicht werden.

Empfohlene Repository-Struktur:

```text
repo/
├── index.html
├── README.md
├── SYNC_SMOKE_TEST.md
├── PWA_SMOKE_TEST.md
├── manifest.json
├── sw.js
├── icons/
│   ├── rilke-192.png
│   └── rilke-512.png
└── vendor/
    ├── jszip-3.10.1.min.js
    └── JSZIP_LICENSE.markdown
```

GitHub Pages aktivieren:

1. Repository auf GitHub öffnen
2. **Settings** → **Pages**
3. Branch `main` auswählen
4. Root-Verzeichnis verwenden
5. GitHub-Pages-URL öffnen

GitHub Pages liefert diese Dateien als statische Website über HTTPS aus; ein Framework, Bundler oder Build-Schritt ist nicht erforderlich. Relative Assetpfade halten die PWA auch unter einem Repository-Subpfad funktionsfähig.

---

## PWA und Offline-Verhalten

Rilke besitzt eine kleine installierbare App-Shell:

* `manifest.json` beschreibt Name, Farben, Startpfad und Icons.
* `sw.js` lädt ausschließlich App-Navigationen zum Repository-Root oder zu `index.html` network-first und nutzt die letzte erfolgreiche `index.html` als Offline-Fallback. Direkte Navigationen zu Dokumentations-, Manifest- oder anderen Dateien können den App-Shell-Cache nicht überschreiben.
* Ausschließlich explizite lokale Dateien (Manifest, Icons und JSZip 3.10.1) werden cache-first behandelt.
* Cross-Origin-, GitHub-/Gist- und Nicht-GET-Requests werden vom Service Worker nicht abgefangen oder gecacht.
* Der Service Worker berührt weder IndexedDB noch `localStorage`; Rilke-Inhalte bleiben in der bestehenden Persistenzarchitektur.
* Es gibt kein Auto-, Background- oder Periodic-Sync. Der verschlüsselte Gist-Sync bleibt ausschließlich manuell.
* Der Cache-Name enthält den kodierten Worker-/Repository-Pfad, zum Beispiel `rilke-app-%2Frilke%2F-v1`. Beim Update werden deshalb nur ältere Cache-Versionen desselben Deployments entfernt; andere Apps oder Rilke-Deployments auf derselben Origin bleiben unangetastet.
* Eine neue Worker-Version übernimmt nicht aggressiv eine laufende Sitzung. Für Änderungen an statischen Assets muss `CACHE_VERSION` in `sw.js` erhöht werden; die neue Version wird im normalen Browser-Lifecycle aktiv.

JSZip 3.10.1 liegt lokal unter `vendor/`. Dadurch bleiben Markdown-ZIP und Recovery-ZIP nach einer erfolgreichen Online-Initialisierung auch offline verfügbar. Die Lizenz liegt daneben.

Die Icons wurden als schlichte, vollflächige PNGs mit einem `R`-Monogramm erzeugt. Hintergrund, Papierfläche, Tinte und Akzentring verwenden ausschließlich die bestehende Rilke-Palette (`#f6f1dc`, `#fff9e6`, `#2a2a2a`, `#c9a227`); das Monogramm bleibt innerhalb der Maskable-Safe-Zone.

Die reproduzierbare Installation-, Offline-, Sync- und Worker-Update-Prüfung steht in [PWA_SMOKE_TEST.md](PWA_SMOKE_TEST.md).

---

## Datenhaltung

Alle Daten werden aktuell lokal im Browser gespeichert.

Wichtig:

* Inhaltsdaten liegen primär in IndexedDB; kleine Konfigurations- und Sync-Metadaten liegen in `localStorage`.
* App-Updates auf GitHub überschreiben diese lokalen Daten nicht.
* Browserdaten löschen bedeutet auch: lokale Rilke-Daten löschen.
* Für Sicherung und Austausch sollte regelmäßig der ZIP-Recovery-Export genutzt werden.
* Der vorhandene verschlüsselte Gist-Sync wird ausschließlich manuell in den Speicher-Einstellungen gestartet; es gibt keinen Auto-Sync.
* Reproduzierbare Prüfungen stehen in der [Zwei-Browser-Sync-Smoke-Testcheckliste](SYNC_SMOKE_TEST.md).

Der Ordner-Modus ist aktuell nur vorbereitet, aber noch nicht aktiv. Es gibt noch keine File System API und keine echte Ordner-Speicherung.

---

## Architekturentscheidungen

### Karte

Eine Karte ist die kleinste poetische Einheit. Sie kann ein Satz, ein Bild, eine Metapher, ein Fragment oder ein Rohgedanke sein.

### PairRelation

Eine PairRelation ist ein gespeicherter Kombinationsgedanke zwischen zwei Karten. Die Brainstorm-Fläche ist nur die Visualisierung; die eigentliche kreative Einheit ist die Relation.

### Composition

Eine Composition ist eine verdichtete Reihenfolge aus Karten. Sie dient als Arbeitsform für Gedichtentwürfe und poetische Textmontagen.

### UID und SID

* `uid` ist die stabile technische Identität.
* `sid` ist die sichtbare Struktur-ID.
* Beziehungen zwischen Karten laufen über `uid`, nicht über `sid`.

---

## Geplante Weiterentwicklung

Mögliche nächste Entwicklungsschritte:

* echten Ordner-Modus konzeptionell planen
* entscheiden, ob `sidParts` persistiert oder aus `sid` abgeleitet wird
* SID-Refactoring für Subtrees vorbereiten
* Markdown-YAML-Export verbessern
* Brainstorm-Sessions stärker strukturieren
* täglichen Rilke-Schreibflow definieren
* optional Obsidian-/Folder-Workflow prüfen

Nicht geplant ist ein Umbau zu einem Dashboard, Task-Manager oder allgemeinen PKM-System.

---

## Projektphilosophie

Rilke soll ruhig, minimalistisch und poetisch bleiben.

Die App soll helfen, eigenes Sprachmaterial ernst zu nehmen: Fragmente sammeln, nebeneinanderlegen, befragen, verschieben, verbinden und langsam zu Text verdichten.

Der Satz bleibt im Zentrum.
