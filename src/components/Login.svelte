<script lang="ts">
  import { defaultServerUrl, pb, setServerUrl } from '../lib/pb';

  let server = $state(defaultServerUrl());
  let error = $state('');
  let busy = $state(false);

  async function login() {
    busy = true;
    error = '';
    try {
      setServerUrl(server);
      // Called straight from the click handler so the OAuth popup isn't blocked.
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
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
  <button class="primary" onclick={login} disabled={busy}>
    {busy ? '…' : 'Mit Google anmelden'}
  </button>
  {#if error}<p class="error">{error}</p>{/if}
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
