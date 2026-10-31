import { CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Sleep } from './native';

// Every Android build publishes a GitHub release with the APK, the web part as
// bundle.zip and latest.json describing both (.github/workflows/android.yml).
const RELEASES = 'https://github.com/rinukkusu/sleep-tracker/releases';

/** Commit the running web part was built from. */
const WEB_VERSION: string = import.meta.env.VITE_WEB_VERSION ?? 'dev';

interface Latest {
  /** Commit of the web part */
  version: string;
  /** scripts/native-id.mjs of the APK it needs */
  nativeId: string;
  /** Release tag, e.g. android-1.14 */
  tag: string;
  apk: string;
  bundle: string;
}

export interface UpdateState {
  /** A new APK is needed; opening this URL downloads it. */
  apkUrl: string | null;
  /** A new web part is downloaded and can be switched to right away. */
  readyId: string | null;
}

const STATUS_KEY = 'ota_status';

/** Last update check, shown at the bottom of the statistics. */
export function lastStatus(): string {
  try {
    return localStorage.getItem(STATUS_KEY) ?? '';
  } catch {
    return '';
  }
}

function setStatus(message: string) {
  const at = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  try {
    localStorage.setItem(STATUS_KEY, `${at}: ${message}`);
  } catch {
    /* only for display */
  }
}

/** Must run on every start, otherwise the updater rolls back to the previous bundle. */
export function confirmBundleWorks() {
  void CapacitorUpdater.notifyAppReady().catch(() => {});
}

/** Switches to a downloaded web part now (reloads the app). */
export function applyNow(id: string) {
  void CapacitorUpdater.set({ id });
}

/**
 * Same native part: download the new web part, it becomes active the next time
 * the app goes to the background (or right away via applyNow). Otherwise a new
 * APK has to be installed.
 */
export async function checkForUpdates(): Promise<UpdateState> {
  const none = { apkUrl: null, readyId: null };
  if (WEB_VERSION === 'dev') return none;
  try {
    // Native request: release downloads redirect to a host without CORS headers.
    const res = await CapacitorHttp.get({ url: `${RELEASES}/latest/download/latest.json` });
    if (res.status !== 200) {
      setStatus(`latest.json HTTP ${res.status}`);
      return none;
    }
    const latest = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as Latest;
    const { nativeId } = await Sleep.info();

    if (latest.nativeId !== nativeId) {
      setStatus(`neue App-Version ${latest.tag} nötig`);
      return { apkUrl: `${RELEASES}/download/${latest.tag}/${latest.apk}`, readyId: null };
    }
    if (latest.version === WEB_VERSION) {
      setStatus('aktuell');
      return none;
    }

    const { bundles } = await CapacitorUpdater.list();
    const ready = bundles.find((b) => b.version === latest.version && (b.status === 'pending' || b.status === 'success'));
    setStatus(ready ? `${latest.version.slice(0, 7)} bereit` : `lädt ${latest.version.slice(0, 7)}…`);
    const next =
      ready ?? (await CapacitorUpdater.download({ url: `${RELEASES}/download/${latest.tag}/${latest.bundle}`, version: latest.version }));
    await CapacitorUpdater.next({ id: next.id });
    setStatus(`${latest.version.slice(0, 7)} bereit`);
    return { apkUrl: null, readyId: next.id };
  } catch (e) {
    setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}
