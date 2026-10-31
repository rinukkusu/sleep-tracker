import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { isNative } from './lib/native';
import './app.css';

// The Android app ships its files in the APK, a service worker would only serve stale ones.
if (!isNative) registerSW({ immediate: true });

export default mount(App, { target: document.getElementById('app')! });
