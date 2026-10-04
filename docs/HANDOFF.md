# Handoff 2.1 · offener Inhalt, eindeutige Zuordnung

Die App erzeugt den vollständigen Vertrag für jede Session in **Prompt 2**. Die Session-ID und Highlight-IDs aus diesem Prompt sind verbindlich. Dieses Dokument beschreibt die Grenze zwischen freien Daten und geprüftem Kern.

Pflichtfelder am Root: type, version, session, items, summary, errors.
Pflichtfelder je Item: highlight_id, outcome, route, user_processing, artifacts, anki, notes.
Zusatzfelder dürfen beliebig verschachteltes JSON enthalten und werden nicht entfernt.

| Feld | Regel |
|---|---|
| type | readwise-workbench-handoff-v2 |
| version | 2.1; alte 2.0-Handoffs bleiben lesbar |
| session.session_id / input_count | Müssen exakt zur offenen Session passen |
| session.completed_at | Tatsächlich bekannter Zeitpunkt oder null |
| items | Jede Eingabe-ID genau einmal |
| outcome | processed, discarded, deferred, error |
| route | Freier Text; discard/defer/error sind reservierte Statusrouten |
| user_processing | Objekt; darf leer sein, zusätzliche Felder frei |
| artifacts | Ergebnisreferenzen mit system, target, action, url, id |
| anki | null oder vollständiger Payload im Anki-Workflow |
| notes | Text |
| actions | Optional; jedes Objekt braucht description und status |
| processed_at | Optional; bekannter Zeitpunkt oder null |
| decision / extra | Optional, freie JSON-Daten |
| summary | Konsistente Standardzähler; weitere Felder erlaubt |
| errors | Liste von Fehlertexten |

Beispiele für freie Routen: feynman_collection, sprint_update, time_sector_task, eine neue selbst gewählte Verwendung. Die App führt daraus keine Automatik aus.

Eine Aktion kann beispielsweise so aussehen (rein synthetisches Beispiel):

```json
{
  "description": "Die nächste Handlung aus dem Highlight im Wochenbereich festgehalten.",
  "status": "completed",
  "system": "notion",
  "target": "Diese Woche",
  "action": "task_created",
  "url": null,
  "details": {
    "reason": "Tatsächliche Begründung aus dem Gespräch",
    "connections": ["Verbindung A", "Verbindung B"],
    "future_report": {"topic": "Lesen und Umsetzung"}
  }
}
```

url:null bedeutet keine bekannte Referenz; keine URL erfinden. Konkrete verfügbare Ergebnislinks zusätzlich unter artifacts angeben. Ein tatsächlich abgeschlossenes Gesprächsergebnis kann ohne externen Write als erledigte Aktion beschrieben werden.

processed verlangt mindestens eine erledigte Aktion, ein tatsächliches Artefakt oder einen vollständigen Anki-Payload. planned ist noch kein Abschluss; failed verlangt outcome:error. Bereits erfolgte Teilergebnisse dürfen bei error/deferred erhalten bleiben.

Bekannte eigene Erklärungsfelder sind Text oder null: own_words, key_distinction, open_question, possible_intermediate_packet_use. Andere Felder in user_processing dürfen beliebiges JSON enthalten. Erklärungen müssen nicht zur bloßen Ablage eines Highlights erfunden werden.

summary.processed/discarded/deferred zählen die jeweiligen Outcomes. anki_ready zählt Highlights mit Kartenpayload, nicht Karten. notion_artifacts zählt eindeutige URLs unter artifacts mit system:notion.

Anki-Payload und dessen Review funktionieren wie bisher; neue freie Daten gehören nicht automatisch in Kartenfelder. Das vollständige Handoff bleibt als Originalbilanz erhalten. Der zusätzliche aktuelle Sync-Status ist im Protokoll separat sichtbar.

Ein identischer Reimport macht nichts. Ein verändertes zweites Handoff derselben abgeschlossenen Session wird blockiert. Weitere Verwendung über „Bewusst wieder aufgreifen“ als neue Runde dokumentieren.

