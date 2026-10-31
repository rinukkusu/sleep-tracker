<script lang="ts">
  import { Browser } from '@capacitor/browser';
  import { isNative, Sleep } from '../lib/native';
  import { defaultServerUrl, pb, setServerUrl } from '../lib/pb';

  let server = $state(defaultServerUrl());
  let error = $state('');
  let busy = $state(false);
  let email = $state('');
  let password = $state('');

  async function loginPassword(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      setServerUrl(server);
      await pb.collection('users').authWithPassword(email.trim(), password);
    } catch (err) {
      const { status } = err as { status?: number };
      error = status === 0 ? 'Server nicht erreichbar' : 'E-Mail oder Passwort falsch';
    } finally {
      busy = false;
    }
  }

  async function login() {
    busy = true;
    error = '';
    try {
      setServerUrl(server);
      if (isNative) {
        // Google blocks logins inside a WebView, so the app uses a Custom Tab.
        // PocketBase hands the result back to us over its realtime connection.
        await pb.collection('users').authWithOAuth2({
          provider: 'google',
          urlCallback: (url) => void Browser.open({ url }),
        });
        await Sleep.bringToFront();
      } else {
        // Called straight from the click handler so the OAuth popup isn't blocked.
        await pb.collection('users').authWithOAuth2({ provider: 'google' });
      }
    } catch (err) {
      const { status, originalError } = err as { status?: number; originalError?: { message?: string } };
      error = /invalid provider/i.test(originalError?.message ?? '')
        ? 'Google-Login ist auf dem Server noch nicht eingerichtet'
        : status === 0
          ? 'Server nicht erreichbar'
          : status === 400 || status === 403
            ? 'Dieser Google-Account ist nicht freigeschaltet'
            : 'Login fehlgeschlagen';
    } finally {
      busy = false;
    }
  }
</script>

<div class="card login">
  <h1>🌙 Schlaf-Tracker</h1>
  <form onsubmit={loginPassword}>
    <input bind:value={email} type="email" autocomplete="username" placeholder="E-Mail" required />
    <input bind:value={password} type="password" autocomplete="current-password" placeholder="Passwort" required />
    <button class="primary" disabled={busy}>{busy ? '…' : 'Anmelden'}</button>
  </form>
  {#if error}<p class="error">{error}</p>{/if}
  <button class="ghost" onclick={login} disabled={busy}>Mit Google anmelden</button>
  <details>
    <summary class="muted">Server</summary>
    <input bind:value={server} type="url" placeholder="https://pb.example.com" />
  </details>
</div>

<style>
  .login {
    width: min(380px, calc(100% - 2rem));
    margin: 12vh auto 0;
    display: grid;
    gap: 1rem;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: 1.4rem;
    text-align: center;
  }

  form {
    display: grid;
    gap: 0.6rem;
  }

  .error {
    color: var(--danger);
    margin: 0;
  }

  details {
    font-size: 0.85rem;
  }

  summary {
    cursor: pointer;
    margin-bottom: 0.5rem;
  }
</style>
