import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Kind, Pause } from './types';

/** A change made from the widget or notification while the web app wasn't looking. */
export interface PendingAction {
  id: string;
  start: string;
  end: string | null;
  kind: Kind;
  pauses: Pause[];
}

interface SleepPlugin {
  info(): Promise<{ nativeId: string; build: number }>;
  /** "permission": Android's settings for installing apps were opened instead. */
  installApk(options: { url: string }): Promise<{ status: 'permission' | 'installing' }>;
  setAuth(options: { baseUrl: string; token: string }): Promise<void>;
  setState(options: { running: { id: string; start: number; kind: Kind; pauses: Pause[] } | null; lastWake: number | null }): Promise<void>;
  takePendingActions(): Promise<{ actions: PendingAction[] }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  bringToFront(): Promise<void>;
  addListener(event: 'pendingActions', listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: 'apkProgress', listener: (e: { percent: number }) => void): Promise<PluginListenerHandle>;
}

/** Running inside the Android app (Capacitor) instead of the browser/PWA. */
export const isNative = Capacitor.isNativePlatform();

/** Native side: android/app/src/main/java/.../SleepPlugin.java */
export const Sleep = registerPlugin<SleepPlugin>('Sleep');
