# Schlaf-Tracker

Schlaf-Tracker für Babys (Nachtschlaf und Nickerchen), synchronisiert zwischen beiden Eltern über PocketBase.
Läuft als PWA im Browser und als Android-App mit Widget und Live-Timer in der Notification.

- Großer Start/Stopp-Button, laufender Timer, „wach seit …“
- „Kurz wach“-Pausen: bleiben Teil desselben Schlafs und zählen nicht als Schlafzeit
- Tagesbalken mit Liste der heutigen Einträge, Verlauf, Einträge nachtragen/bearbeiten/löschen
- Statistik: Schlafmuster, Wochensummen, Nickerchen, Uhrzeiten, Wachphasen, Rekorde
- Vorhersage des nächsten Schlafs anhand der typischen Wachphase (1., 2., 3. Wachphase des Tages)
- Offline-fähig: Änderungen werden lokal gespeichert und synchronisiert, sobald wieder online
- Realtime-Sync zwischen mehreren Handys

Android-App zusätzlich:

- Homescreen-Widget (1×1, schmal, hoch) mit Mond-Button, Pause und Stopp
- Laufende Notification mit Stoppuhr, auch auf dem Lockscreen und als Live Update (Android 16)
- Sync per Firebase Cloud Messaging, auch wenn die App geschlossen ist
- Updates: der Web-Teil kommt over-the-air, neue APKs lassen sich direkt in der App installieren

Stack: Svelte 5, Vite, `vite-plugin-pwa`, PocketBase, Capacitor 8 (Android), `@capgo/capacitor-updater`.

## PocketBase einrichten

1. [PocketBase](https://pocketbase.io/docs/) (≥ 0.23) herunterladen und z.B. nach `pocketbase/` entpacken.
2. `pocketbase/pb_migrations` und `pocketbase/pb_hooks` daneben liegen lassen. Beim Start werden die Collections angelegt und die öffentliche Registrierung abgeschaltet.
3. Starten: `./pocketbase serve --http=0.0.0.0:8090`
4. Superuser anlegen: `./pocketbase superuser upsert EMAIL PASS`
5. Im Admin-UI unter **users** für jeden Elternteil einen Eintrag mit E-Mail und Passwort anlegen. Selbst registrieren kann sich niemand.
6. Optional Google-Login: in der Google Cloud Console einen OAuth-Client (Webanwendung) mit Redirect-URI `https://<pb-domain>/api/oauth2-redirect` anlegen und Client-ID/Secret unter *users → Options → OAuth2 → Google* eintragen. Anmelden kann sich nur, wer schon als User mit derselben Mail-Adresse existiert.

Für Notifications und Installation braucht es HTTPS (z.B. über Caddy oder einen Reverse-Proxy vor PocketBase).

## Web-App hosten

**Variante A - direkt aus PocketBase:**

```bash
npm ci
npm run build
cp -r dist/* pocketbase/pb_public/
```

Die App läuft dann unter derselben Adresse wie PocketBase, der Server im Login ist schon vorausgefüllt.

**Variante B - GitHub Pages:** `.github/workflows/deploy.yml` baut bei jedem Push auf `main`.
Unter *Settings → Secrets and variables → Actions → Variables* `PB_URL` setzen, damit die Server-Adresse vorausgefüllt ist.

## Push-Sender

Der Sidecar in `push/` verschickt die Pushes, die die Hooks in `pocketbase/pb_hooks/` auslösen:

- Web Push an die PWA: solange ein Schlaf läuft jede Minute die aktuelle Dauer, Änderungen sofort
- FCM an die Android-App: bei jeder Änderung, damit Widget und Notification aktuell bleiben

```bash
docker build -t pb-push push/
docker run -d --name pb-push --restart unless-stopped --network host -v /opt/pb-push/data:/data pb-push
```

Er lauscht nur auf `127.0.0.1:8091` und braucht keine Zugangsdaten zu PocketBase. Beim ersten Start erzeugt er die VAPID-Keys in `/data/vapid.json`.
Für FCM den Service-Account-Key aus Firebase (*Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren*) als `/data/firebase.json` ablegen. Ohne die Datei läuft nur Web Push.

## Android-App

Gebaut wird in `.github/workflows/android.yml` bei jedem Push auf `main`. Jeder Build wird ein GitHub-Release `android-1.N` mit APK, `bundle.zip` und `latest.json`.

Benötigte Einstellungen unter *Settings → Secrets and variables → Actions*:

| Name | Art | Inhalt |
| --- | --- | --- |
| `PB_URL` | Variable | Adresse des PocketBase-Servers |
| `ANDROID_KEYSTORE_BASE64` | Secret | Keystore (base64), Alias `sleeptracker` |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | Passwort für Keystore und Key |
| `GOOGLE_SERVICES_JSON_BASE64` | Secret | `google-services.json` aus Firebase (base64), optional |

Keystore anlegen (gut aufheben, Updates müssen immer mit demselben Key signiert sein):

```bash
keytool -genkeypair -v -keystore release.jks -alias sleeptracker -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks
```

Ohne Keystore-Secrets wird nur eine Debug-APK als Artifact gebaut, ohne Release.

Für FCM in der [Firebase Console](https://console.firebase.google.com/) ein Projekt anlegen, eine Android-App mit dem Paketnamen `io.github.rinukkusu.sleeptracker` hinzufügen und die `google-services.json` als Secret hinterlegen.

### Updates

- **Web-Teil (OTA):** Beim Öffnen holt die App `latest.json` aus dem neuesten Release. Passt die native Version (`scripts/native-id.mjs`, ein Hash über `android/`, Capacitor-Config und native Pakete), wird `bundle.zip` geladen und beim nächsten Start bzw. per Tipp auf das Banner aktiviert.
- **Native Änderungen:** Die App zeigt „Neue App-Version verfügbar“ und installiert die APK selbst. Beim ersten Mal muss man „Apps installieren“ für die App erlauben.

In einem Fork die Release-Adresse in `src/lib/ota.ts` (`RELEASES`) und ggf. den Paketnamen in `capacitor.config.ts` / `android/app/build.gradle` anpassen.

## Entwicklung

```bash
npm install
npm run dev
```

- `npm run check` - Typecheck
- `npm run icons` - PWA-Icons aus `public/icon.svg` neu generieren
- `npx cap sync android` und `npx cap open android` - Android-Projekt lokal bauen
