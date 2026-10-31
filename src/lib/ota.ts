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
}

/** Must run on every start, otherwise the updater rolls back to the previous bundle. */
export function confirmBundleWorks() {
  void CapacitorUpdater.notifyAppReady().catch(() => {});
}

/**
 * Same native part: download the new web part, it becomes active the next time
 * the app goes to the background. Otherwise a new APK has to be installed.
 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (WEB_VERSION === 'dev') return { apkUrl: null };
  // Native request: release downloads redirect to a host without CORS headers.
  const res = await CapacitorHttp.get({ url: `${RELEASES}/latest/download/latest.json`, responseType: 'json' });
  if (res.status !== 200) return { apkUrl: null };
  const latest = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as Latest;
  const { nativeId } = await Sleep.info();

  if (latest.nativeId !== nativeId) return { apkUrl: `${RELEASES}/download/${latest.tag}/${latest.apk}` };
  if (latest.version === WEB_VERSION) return { apkUrl: null };

  const { bundles } = await CapacitorUpdater.list();
  const ready = bundles.find((b) => b.version === latest.version && (b.status === 'pending' || b.status === 'success'));
  const next =
    ready ?? (await CapacitorUpdater.download({ url: `${RELEASES}/download/${latest.tag}/${latest.bundle}`, version: latest.version }));
  await CapacitorUpdater.next({ id: next.id });
  return { apkUrl: null };
}
