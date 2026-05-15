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

## Portainer

In Portainer kannst du die App direkt als Git-Stack deployen.

- Repository URL: `https://github.com/sandavdesigns/homebase.git`
- Branch: `main`
- Compose path: `docker-compose.yml`

Environment variables in Portainer:

```text
HOMEBASE_PORT=3000
HOMEBASE_INTERNAL_PORT=3000
HOMEBASE_CONTAINER_NAME=homebase
HOMEBASE_VOLUME_NAME=homebase_data
```

Wenn Port `3000` schon belegt ist, reicht meistens nur:

```text
HOMEBASE_PORT=3001
```

Dann bleibt die App intern auf `3000`, ist aber extern unter `http://<server-ip>:3001/` erreichbar.

## Daten

Die Links werden im Docker-Volume `homebase_data` gespeichert. Den Volume-Namen kannst du mit `HOMEBASE_VOLUME_NAME` ändern.

## Im Browser pflegen

- `+ Link` legt neue Links an.
- `...` an einem Link bearbeitet oder löscht ihn.
- `Titel` ändert Titel und Untertitel.
- `Export` lädt die aktuelle JSON-Konfiguration herunter.
