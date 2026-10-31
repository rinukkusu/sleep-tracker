import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The icon is full-bleed, so no extra padding and a dark instead of white background.
const fill = { padding: 0, resizeOptions: { background: '#0c0f22', fit: 'contain' as const } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, ...fill },
    maskable: { ...minimal2023Preset.maskable, ...fill },
    apple: { ...minimal2023Preset.apple, ...fill },
  },
  images: ['public/icon.svg'],
});
