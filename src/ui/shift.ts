/**
 * Tracks whether Shift is held, for the DOM menus. Holding Shift is how you lie:
 * menus show their false options only while it is down.
 */
type Listener = (down: boolean) => void;

let down = false;
const listeners = new Set<Listener>();

function set(value: boolean): void {
  if (value === down) return;
  down = value;
  for (const l of listeners) l(down);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') set(true);
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') set(false);
});
window.addEventListener('blur', () => set(false));

export const shift = {
  get down(): boolean {
    return down;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
