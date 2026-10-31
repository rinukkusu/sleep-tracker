<script lang="ts">
  import { untrack } from 'svelte';
  import { newId } from '../lib/pb';
  import { store } from '../lib/store.svelte';
  import { defaultKind, fmtTime, fromLocalInput, kindIcon, kindLabel, toLocalInput } from '../lib/time';
  import type { Kind, Sleep } from '../lib/types';

  /** `sleep` null = new entry */
  let { sleep, onclose }: { sleep: Sleep | null; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  const original = untrack(() => sleep);
  const isNew = !original;
  const initial: Sleep = original ?? {
    id: newId(),
    start: new Date(Date.now() - 3600_000).toISOString(),
    end: new Date().toISOString(),
    kind: defaultKind(new Date(Date.now() - 3600_000)),
    note: '',
    pauses: [],
  };

  let kind = $state<Kind>(initial.kind);
  let start = $state(toLocalInput(initial.start));
  let end = $state(initial.end ? toLocalInput(initial.end) : '');
  let note = $state(initial.note);
  let pauses = $state((initial.pauses ?? []).map((p) => ({ ...p })));
  let error = $state('');

  $effect(() => {
    dialog.showModal();
  });

  function save(e: SubmitEvent) {
    e.preventDefault();
    const s = fromLocalInput(start);
    const en = end ? fromLocalInput(end) : null;
    if (en && en <= s) {
      error = 'Ende muss nach dem Start liegen';
      return;
    }
    if (!en && store.running && store.running.id !== initial.id) {
      error = 'Es läuft schon ein Schlaf - bitte ein Ende angeben';
      return;
    }
    store.put({ ...initial, kind, start: s, end: en, note: note.trim(), pauses: $state.snapshot(pauses) });
    dialog.close();
  }

  function remove() {
    if (!confirm('Eintrag löschen?')) return;
    store.remove(initial.id);
    dialog.close();
  }
</script>

<dialog bind:this={dialog} onclose={onclose}>
  <form onsubmit={save}>
    <div class="title">
      <h2>{isNew ? 'Eintrag nachtragen' : 'Eintrag bearbeiten'}</h2>
      {#if !isNew}
        <button type="button" class="danger" onclick={remove}>Löschen</button>
      {/if}
    </div>

    <div class="kinds">
      {#each ['night', 'nap'] as const as k}
        <button type="button" class="{k}" class:active={kind === k} onclick={() => (kind = k)}>
          {kindIcon[k]} {kindLabel[k]}
        </button>
      {/each}
    </div>

    <label>
      Eingeschlafen
      <input type="datetime-local" bind:value={start} required />
    </label>
    <label>
      Aufgewacht
      <input type="datetime-local" bind:value={end} />
      {#if !end}<small>leer = schläft noch</small>{/if}
    </label>
    {#if pauses.length}
      <div class="pauses">
        <span>Kurz wach</span>
        {#each pauses as p, i (p.start)}
          <div class="pause">
            <span class="tabular">{fmtTime(p.start)} – {p.end ? fmtTime(p.end) : 'jetzt'}</span>
            <button type="button" class="ghost" onclick={() => pauses.splice(i, 1)} aria-label="Pause entfernen">✕</button>
          </div>
        {/each}
      </div>
    {/if}
    <label>
      Notiz
      <input bind:value={note} placeholder="optional" maxlength="500" />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <div class="actions">
      <button type="button" class="ghost" onclick={() => dialog.close()}>Abbrechen</button>
      <button class="primary">Speichern</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: 0;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    width: min(440px, calc(100vw - 2rem));
    padding: 1.25rem;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.6);
  }

  form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
  }

  input {
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .kinds {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .kinds button.active.night {
    background: var(--night);
    color: #fff;
  }

  .kinds button.active.nap {
    background: var(--nap);
    color: #1a1a1a;
  }

  small {
    color: var(--muted);
  }

  .pauses {
    display: grid;
    gap: 0.25rem;
  }

  .pause {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--muted);
  }

  .pause button {
    padding: 0.2rem 0.6rem;
  }

  .error {
    color: var(--danger);
    margin: 0;
  }

  .title {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title button {
    padding: 0.4rem 0.5rem;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
</style>
