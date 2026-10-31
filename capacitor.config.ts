import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.rinukkusu.sleeptracker',
  appName: 'Schlaf-Tracker',
  webDir: 'dist',
  plugins: {
    // Self-hosted updates of the web part (src/lib/ota.ts), no Capgo cloud.
    CapacitorUpdater: {
      autoUpdate: false,
      updateUrl: '',
      statsUrl: '',
      channelUrl: '',
      appReadyTimeout: 10000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
    },
  },
};

export default config;
