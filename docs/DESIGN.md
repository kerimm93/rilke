# Designvertrag · Workbench 2.0

Bei Änderungen zuerst diese Datei lesen. Keine neue Designbibliothek oder ein zweites Farbsystem einführen.

Warm-Paper nach KERIM APP SYSTEM v3: Hintergrund `#F4ECDC`, Oberfläche `#FCF8EF`, Text `#2C2419`, Linie `#E3D8C1`, ein Aktionsakzent `#C24A2B`. Semantische Farben nur für kleine Statushinweise. Keine großflächigen Statusfarben und kein Hover-Lift.

Systemschriften und Georgia statt externer Font-Requests. E-Ink-Modus schwarz/weiß. Touch-Flächen mindestens 44px. Off-Canvas-Navigation unter 940px, einspaltige Formulare unter 560px. Primärer Arbeitsbereich maximal 1020px für lesbare Zweispalten-Vergleiche; Fließtext/Einleitungen schmaler.

Fünf Bereiche:

1. Eingang: Highlights und Workflow für eine neue Session auswählen; Ziel im Chat entscheiden.
2. Sessions: Verwendung, Zwischenstand, zwei Prompts, Handoff-Vorschau. Keine Pflicht zur eigenen Erklärung vor bloßer Ablage.
3. Anki-Review: prüfen/freigeben vor Schreibaktion.
4. Verlauf: alle Verarbeitungsrunden, Aktionen und tatsächliche Zielreferenzen. Suchbar, vollständiger JSON-Export; freie Daten unter Details.
5. Einstellungen: persönliche Workflow-Vorlagen, lokale Verbindungen, manueller Abgleich, Recovery.

Notion / flexibel steht bei den Vorlagen immer vor Dialog + AnkiConnect. Vorlagentexte liegen in aufklappbaren Editoren mit mindestens 220px Höhe. Workflow-Auswahl im unteren Aktionsbereich des Eingangs; auf Mobilgeräten einspaltig. Lange freie Routen und die Protokollüberschrift müssen bei 390px ohne verbreiterten Viewport umbrechen.

Im Eingang steht eine beschriftete Sortierauswahl oberhalb der Suche. Standard: neueste Highlights zuerst; alternativ älteste Highlights, letzter Import oder wieder aufgegriffene Kandidaten. Schnellauswahl und neue Sessionreihenfolge stimmen mit der Anzeige überein. Umsortieren erhält ausgewählte IDs, bestehende Sessions bleiben unverändert. Highlight- und Importdatum sind getrennt sichtbar. Die Auswahl ist lokal pro Gerät gespeichert.

Ein Hauptschritt pro Panel; technische Rohdaten und Templates unter Details. Inhalte nicht als HTML ausführen. Quellenlinks öffnen getrennt mit `noopener noreferrer`. Mutierende Netzwerk-/Speicheraktionen sperren die Arbeitsfläche während des Vorgangs. Explizite Form-Speicheraktionen statt verstecktem Autosave; ungespeicherte Felder bleiben bis Tab-Ende als UI-Entwurf und blockieren den Cloud-Sync.
