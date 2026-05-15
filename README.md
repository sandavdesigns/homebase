# Homebase Startpage

Eine kleine Docker-Startseite, deren Links direkt im Browser gepflegt werden.

## Starten

```bash
docker compose up -d --build
```

Danach ist die Seite unter `http://localhost:3000` erreichbar. Im Heimnetz nutzt du die IP des Hosts, zum Beispiel:

```text
http://192.168.1.16:3000/
```

## Daten

Die Links werden in `./data/homebase.json` gespeichert. Der Ordner wird durch Docker Compose als Volume in den Container gemountet.

## Im Browser pflegen

- `+ Link` legt neue Links an.
- `...` an einem Link bearbeitet oder löscht ihn.
- `Titel` ändert Titel und Untertitel.
- `Export` lädt die aktuelle JSON-Konfiguration herunter.
