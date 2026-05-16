# Homebase Startpage

Homebase ist eine kleine, Docker-freundliche Startseite fuer das Heimnetz. Links, Kategorien, Seitentitel und Untertitel werden direkt im Browser gepflegt und dauerhaft in einem Docker-Volume gespeichert.

## Funktionen

- Browserbasierte Pflege von Links, Kategorien, Profilen, Notizen, Titel und Untertitel
- Einklappbare Suche ueber Linktitel, Kategorie und Notiz
- Automatisch gruppierte Kategorien mit alphabetischer Sortierung
- JSON-Import und JSON-Export der aktuellen Konfiguration
- Automatischer Favicon-Abruf mit lokalem Cache
- Optionale Link-Statusanzeigen fuer Proxmox, Unraid, AMP und einfache HTTP-Dienste
- Themes: Retro, Time Circuit, Dark, Light und Terminal
- Optionaler Admin-Modus mit Passwortschutz fuer Bearbeitung
- Widgets fuer Uhr und mehrere Notizen

## Erster Start

Voraussetzungen:

- Docker mit Docker Compose
- Ein freier Host-Port, standardmaessig `3000`

Start lokal:

```bash
cp .env.example .env
docker compose up -d
```

Danach ist Homebase unter `http://localhost:3000` erreichbar. Im Heimnetz nutzt du die IP des Docker-Hosts, zum Beispiel:

```text
http://192.168.1.16:3000/
```

Beim ersten Start erscheint ein Setup-Dialog. Dort legst du Seitentitel, erstes Profil und ein Admin-Passwort fest.

## Portainer Deploy

In Portainer kannst du Homebase als Git-Stack deployen.

- Repository URL: `https://github.com/sandavdesigns/homebase.git`
- Branch: `main`
- Compose path: `docker-compose.yml`

Empfohlene Stack-Variablen:

```text
HOMEBASE_IMAGE=ghcr.io/sandavdesigns/homebase:latest
HOMEBASE_PORT=3000
HOMEBASE_INTERNAL_PORT=3000
HOMEBASE_CONTAINER_NAME=homebase
HOMEBASE_VOLUME_NAME=homebase_data
```

Alternativ kannst du in Portainer einen Stack direkt mit dem Image anlegen:

```yaml
services:
  homebase:
    image: ghcr.io/sandavdesigns/homebase:latest
    container_name: homebase
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      HOST: 0.0.0.0
      DATA_DIR: /data
      ADMIN_PASSWORD:
    volumes:
      - homebase_data:/data

volumes:
  homebase_data:
```

Wenn Port `3000` auf dem Host schon belegt ist, aendere nur den externen Port:

```text
HOMEBASE_PORT=3001
```

Die App bleibt im Container auf `3000`, ist aber extern unter `http://<server-ip>:3001/` erreichbar.

## Environment Variablen

Die Compose-Datei verwendet `HOMEBASE_*` Variablen fuer Deployment-Details und setzt daraus die Container-Umgebung.

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `HOMEBASE_IMAGE` | `ghcr.io/sandavdesigns/homebase:latest` | Docker Image fuer den Stack. Fuer reproduzierbare Deployments auf einen Versions-Tag setzen. |
| `HOMEBASE_PORT` | `3000` | Externer Host-Port. |
| `HOMEBASE_INTERNAL_PORT` | `3000` | Interner Container-Port und Wert fuer `PORT`. Normalerweise unveraendert lassen. |
| `HOMEBASE_CONTAINER_NAME` | `homebase` | Name des Containers. |
| `HOMEBASE_VOLUME_NAME` | `homebase_data` | Name des Docker-Volumes fuer Daten und Favicons. |
| `ADMIN_PASSWORD` | leer | Optionales Admin-Passwort. Alternativ kann das Passwort beim ersten Start im Setup gesetzt werden. |
| `HOMEBASE_STATUS_TARGETS` | `[]` | Optionales JSON fuer Link-Statusanzeigen. Secrets bleiben in der Container-Umgebung. |

Container-interne Variablen:

- `PORT`: Wird von `HOMEBASE_INTERNAL_PORT` gesetzt.
- `HOST`: Wird im Container auf `0.0.0.0` gesetzt.
- `DATA_DIR`: Wird im Container auf `/data` gesetzt.

## Docker Image

Das Image wird per GitHub Actions automatisch gebaut und in GitHub Container Registry veroeffentlicht:

```text
ghcr.io/sandavdesigns/homebase:latest
```

Bei Pushes auf `main` wird `latest` aktualisiert. Git-Tags im Format `v0.1.0` erzeugen zusaetzliche versionierte Image-Tags. Pull Requests werden nur gebaut, aber nicht gepusht.

Fuer lokale Entwicklung mit Build aus dem Repository:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Profile

Profile werden direkt im Browser verwaltet. Jedes Profil hat eigene Kategorien und Links, teilt sich aber Titel, Theme, Widgets und Favicon-Cache mit der Homebase-Instanz.

- `+ Profil` erstellt ein neues Profil.
- `Profil löschen` entfernt das aktive Profil, solange mindestens ein weiteres Profil existiert.
- Das Profil-Dropdown wechselt zwischen Profilen.

## Admin-Modus

Wenn ein Admin-Passwort gesetzt ist, bleibt die Startseite sichtbar, aber Bearbeiten, Import, Export und Profilverwaltung sind gesperrt. Ueber `Admin gesperrt` kannst du entsperren. Ueber `Admin offen` sperrst du die Bearbeitung wieder.

Das Passwort kann entweder per `ADMIN_PASSWORD` als Environment-Variable gesetzt werden oder beim ersten Start im Setup. Das Setup-Passwort wird gehasht in `homebase.json` gespeichert.

## Themes

Das Theme-Dropdown wechselt zwischen `Retro`, `Time Circuit`, `Dark`, `Light` und `Terminal`. Die Auswahl wird in `homebase.json` gespeichert.

## Import und Export

Export:

- Im Browser auf `Export` klicken.
- Alternativ `http://<server-ip>:<port>/api/homebase/export` aufrufen.
- Die Datei wird als `homebase.json` heruntergeladen.

Import:

- Im Browser auf `Import` klicken.
- JSON-Datei auswaehlen oder JSON direkt einfuegen.
- `Importieren` ersetzt die aktuelle Konfiguration.

Die Datei liegt im Container unter:

```text
/data/homebase.json
```

Beim Schreiben normalisiert Homebase Daten wie fehlende IDs, Kategorien und URLs. Gueltige URLs duerfen mit `http://`, `https://`, `mailto:` oder `tel:` beginnen.

## Backups

Wichtige Daten liegen im Docker-Volume:

- `homebase.json`: Startseiten-Konfiguration
- `favicons/`: Lokaler Favicon-Cache

Ein einfaches Backup ist der JSON-Export aus dem Browser. Fuer ein vollstaendiges Volume-Backup sichere das Docker-Volume `HOMEBASE_VOLUME_NAME`.

Beispiel mit einem temporaeren Alpine-Container:

```bash
docker run --rm \
  -v homebase_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/homebase_data.tar.gz -C /data .
```

Restore:

```bash
docker compose down
docker run --rm \
  -v homebase_data:/data \
  -v "$PWD":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/homebase_data.tar.gz -C /data"
docker compose up -d
```

Pruefe vor dem Restore, dass der Volume-Name zum Zielsystem passt.

## Favicon Cache

Favicons werden automatisch ueber `/api/favicon?url=...` geladen und unter `/data/favicons/` gecacht. Der Browser darf Favicons bis zu sieben Tage cachen.

Wenn ein Icon falsch oder veraltet ist:

1. Container stoppen.
2. Den Ordner `favicons/` im Daten-Volume loeschen oder einzelne Cache-Dateien entfernen.
3. Container starten.
4. Browser-Cache hart aktualisieren, falls das alte Icon weiterhin angezeigt wird.

Wenn kein Icon geladen werden kann, zeigt Homebase ein eingebautes Fallback-Icon.

## Widgets

Diese Version enthaelt diese Widgets:

- Datum
- Uhrzeit
- Mehrere Notizen
- Link-Statusanzeigen, wenn ein Link ein Status-Widget aktiviert hat

## Einstellungen

Im Browser-Menue `Einstellungen` kannst du Titel und Untertitel pflegen und Anzeigeoptionen umschalten:

- Kategorie-Zahlen anzeigen
- Status an Linkkarten anzeigen
- Notizenbereich anzeigen
- Links in neuem Tab oeffnen

## Status Widgets

Statusanzeigen werden direkt am Link gepflegt:

- Link bearbeiten oder neu erstellen
- `Status-Widget an diesem Link` aktivieren
- Typ auswaehlen
- Die passenden Zugangsdaten eintragen

Wenn die Status-URL leer bleibt, nutzt Homebase die normale Link-URL. Dadurch kannst du mehrere Server vom gleichen Typ als eigene Links mit eigenen Widgets pflegen.

Proxmox mit API-Token:

- Widget: `Proxmox`
- Token-ID: zum Beispiel `root@pam!homebase`
- Token-Secret: dein Proxmox API-Token

Ohne Proxmox-Token prueft Homebase nur die API-Erreichbarkeit. Mit Token zeigt es zusaetzlich Nodes, laufende VM/CT und RAM-Nutzung an. Unraid nutzt einen API-Key fuer `/graphql`; AMP nutzt Benutzername und Passwort fuer `Core/Login` und `Core/GetStatus`.

Status-Zugangsdaten werden in `homebase.json` gespeichert und sind damit auch im JSON-Export enthalten. Wenn du Secrets lieber ausschliesslich als Container-Environment halten willst, funktioniert `HOMEBASE_STATUS_TARGETS` weiterhin als Fallback:

```text
HOMEBASE_STATUS_TARGETS=[{"type":"proxmox","name":"Proxmox","url":"https://192.168.1.15:8006","tokenId":"root@pam!homebase","tokenSecret":"dein-token-secret"}]
```

## Updates

Lokales Update:

```bash
git pull
docker compose pull
docker compose up -d
```

Portainer Update:

1. Stack oeffnen.
2. `Pull latest image/redeploy` oder `Update the stack` ausfuehren.
3. Bei Git-Stacks sicherstellen, dass Branch `main` und Compose path `docker-compose.yml` weiterhin stimmen.

Das Daten-Volume bleibt bei normalen Updates erhalten. Loesche das Volume nur, wenn du bewusst alle Homebase-Daten entfernen willst.

Nach dem Update:

- `http://<server-ip>:<port>/api/health` sollte `{"ok":true}` liefern.
- Startseite im Browser neu laden.
- Export testen, wenn Datenmigrationen erwartet werden.

## Bedienung im Browser

- `+ Link` legt neue Links an.
- `...` an einem Link bearbeitet oder loescht ihn.
- `+ Profil` erstellt ein weiteres Profil.
- `Einstellungen` aendert Titel, Untertitel, Anzeigeoptionen, Kategorien, Import und Export.

Kategorien und Links werden alphabetisch angezeigt. Linkkarten zeigen Titel, Favicon und optionale Notiz; die URL bleibt als Klickziel hinterlegt, wird aber nicht extra angezeigt.
