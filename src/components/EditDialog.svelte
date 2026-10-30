<script lang="ts">
  import { untrack } from 'svelte';
  import { newId } from '../lib/pb';
  import { store } from '../lib/store.svelte';
  import { defaultKind, fromLocalInput, kindIcon, kindLabel, toLocalInput } from '../lib/time';
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
  };

  let kind = $state<Kind>(initial.kind);
  let start = $state(toLocalInput(initial.start));
  let end = $state(initial.end ? toLocalInput(initial.end) : '');
  let note = $state(initial.note);
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
    store.put({ ...initial, kind, start: s, end: en, note: note.trim() });
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
    <h2>{isNew ? 'Eintrag nachtragen' : 'Eintrag bearbeiten'}</h2>

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
    <label>
      Notiz
      <input bind:value={note} placeholder="optional" maxlength="500" />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <div class="actions">
      {#if !isNew}
        <button type="button" class="danger" onclick={remove}>Löschen</button>
      {/if}
      <span></span>
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
    gap: 0.9rem;
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

  .error {
    color: var(--danger);
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .actions span {
    flex: 1;
  }
</style>
