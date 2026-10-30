<script lang="ts">
  import { defaultServerUrl, pb, setServerUrl } from '../lib/pb';

  let server = $state(defaultServerUrl());
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      setServerUrl(server);
      await pb.collection('users').authWithPassword(email, password);
    } catch (err) {
      error = (err as { status?: number }).status === 0 ? 'Server nicht erreichbar' : 'Login fehlgeschlagen';
    } finally {
      busy = false;
    }
  }
</script>

<form class="card" onsubmit={submit}>
  <h1>🌙 Schlaf-Tracker</h1>
  <label>
    Server
    <input bind:value={server} type="url" required placeholder="https://pb.example.com" />
  </label>
  <label>
    E-Mail
    <input bind:value={email} type="email" autocomplete="username" required />
  </label>
  <label>
    Passwort
    <input bind:value={password} type="password" autocomplete="current-password" required />
  </label>
  {#if error}<p class="error">{error}</p>{/if}
  <button class="primary" disabled={busy}>{busy ? '…' : 'Anmelden'}</button>
</form>

<style>
  form {
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
</style>
