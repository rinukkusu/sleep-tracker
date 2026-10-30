# Schlaf-Tracker

PWA zum Tracken von Schlafzeiten (Nachtschlaf und Nickerchen) mit Sync über PocketBase.

- Großer Start/Stopp-Button, laufender Timer, „wach seit …“
- Tagesbalken (0-24 Uhr) für heute und im Verlauf, Einträge antippen zum Bearbeiten
- Einträge nachtragen, bearbeiten, löschen
- Offline-fähig: Änderungen werden lokal gespeichert und synchronisiert, sobald wieder online
- Realtime-Sync zwischen mehreren Handys
- Notification „Schläft seit 14:32“ mit „Aufgewacht“-Button (Android)

Stack: Svelte 5, Vite, `vite-plugin-pwa`, PocketBase JS SDK.

## PocketBase einrichten

1. [PocketBase](https://pocketbase.io/docs/) (≥ 0.23) herunterladen und z.B. nach `pocketbase/` entpacken.
2. Den Ordner `pocketbase/pb_migrations` daneben liegen lassen - beim Start wird automatisch die Collection `sleeps` angelegt und die öffentliche Registrierung abgeschaltet.
3. Starten: `./pocketbase serve --http=0.0.0.0:8090`
4. Superuser anlegen: `./pocketbase superuser upsert EMAIL PASS`
5. Google-Login: in der Google Cloud Console einen OAuth-Client (Webanwendung) mit Redirect-URI `https://<pb-domain>/api/oauth2-redirect` anlegen und Client-ID/Secret im Admin-UI unter *users → Options → OAuth2 → Google* eintragen.
6. Unter **users** für jeden Elternteil einen Eintrag mit der Google-Mail-Adresse anlegen (Passwort egal, wird nicht benutzt). Andere Google-Accounts können sich nicht anmelden.

## Hosting

**Variante A - direkt aus PocketBase (empfohlen):**

```bash
npm ci
npm run build
cp -r dist/* pocketbase/pb_public/
```

Die App läuft dann unter derselben Adresse wie PocketBase, der Server-Eintrag im Login ist schon vorausgefüllt.
Für Notifications und Installation braucht es HTTPS (z.B. über Caddy oder einen Reverse-Proxy).

**Variante B - GitHub Pages:** Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push auf `main`.
Unter *Settings → Secrets and variables → Actions → Variables* kann `PB_URL` gesetzt werden, damit die Server-Adresse im Login vorausgefüllt ist.

## Entwicklung

```bash
npm install
npm run dev
```

- `npm run check` - Typecheck
- `npm run icons` - PWA-Icons aus `public/icon.svg` neu generieren

## Notification-Timer

Web-Notifications können keinen live laufenden Timer anzeigen. Deshalb zeigt die Notification die Startzeit an.
Für einen echten Chronometer müsste man die App z.B. mit Capacitor verpacken und ein kleines natives Plugin (`setUsesChronometer`) schreiben.
