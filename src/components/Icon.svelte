<script lang="ts">
  // Inline SVG icons - some Unicode symbols (⏻, ⟳) are missing from Android's default fonts.
  const paths = {
    logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
    sync: 'M20 11a8 8 0 0 0-14.3-4.3L4 9M4 4v5h5M4 13a8 8 0 0 0 14.3 4.3L20 15M20 20v-5h-5',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
    now: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
    history: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    stats: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
  };

  let { name, size = 18 }: { name: keyof typeof paths; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={paths[name]} />
</svg>

<style>
  svg {
    vertical-align: -0.15em;
  }
</style>
