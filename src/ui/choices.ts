/** A numbered list of buttons, also selectable with keys 1–9. Shared by every panel. */
export interface Choice {
  label: string;
  /** Marks a false option (only shown while Shift is held). */
  lie?: boolean;
  onPick(): void;
}

export function renderChoices(container: HTMLElement, choices: Choice[]): HTMLElement {
  const list = document.createElement('div');
  list.className = 'choices';
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (c.lie) b.classList.add('lie');
    if (i < 9) {
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      b.appendChild(num);
    }
    b.append(c.label);
    if (c.lie) {
      const tag = document.createElement('span');
      tag.className = 'lie-tag';
      tag.textContent = 'LIE';
      b.appendChild(tag);
    }
    // Don't take focus, so Space/Enter never re-trigger a button by accident.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => c.onPick());
    list.appendChild(b);
  });
  container.appendChild(list);
  return list;
}

/** Maps a keydown to a choice index (0-based) for keys 1–9, or -1. Works with Shift held. */
export function choiceIndexFromKey(e: KeyboardEvent): number {
  const m = /^Digit([1-9])$/.exec(e.code);
  return m ? Number(m[1]) - 1 : -1;
}

export function isAdvanceKey(e: KeyboardEvent): boolean {
  return e.code === 'Space' || e.code === 'Enter';
}
