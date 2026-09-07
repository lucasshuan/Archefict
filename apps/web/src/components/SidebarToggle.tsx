export function SidebarToggle(props: { open: boolean; onToggle: () => void }) {
  const label = () => (props.open ? "Close sidebar" : "Open sidebar");

  return (
    <button
      type="button"
      class="fixed left-4 top-3 z-30 rounded-app p-1.5 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg motion-reduce:transition-none"
      classList={{ "text-fg": props.open }}
      aria-label={label()}
      title={label()}
      aria-controls="campaign-drawer"
      aria-expanded={props.open}
      data-open={props.open}
      onClick={() => props.onToggle()}
    >
      <span class="hamburger-icon" aria-hidden="true">
        <span class="hamburger-line" />
        <span class="hamburger-line" />
        <span class="hamburger-line" />
      </span>
    </button>
  );
}
