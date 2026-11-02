/** A numbered list of buttons, also selectable with keys 1–9. Shared by every modal. */
export interface Choice {
  label: string;
  onPick(): void;
}

export function renderChoices(container: HTMLElement, choices: Choice[]): void {
  const list = document.createElement('div');
  list.className = 'choices';
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${i < 9 ? `<span class="num">${i + 1}</span>` : ''}`;
    b.append(c.label);
    b.addEventListener('click', () => c.onPick());
    list.appendChild(b);
  });
  container.appendChild(list);
}

/** Maps a keydown to a choice index (0-based) for keys 1–9, or -1. */
export function choiceIndexFromKey(e: KeyboardEvent): number {
  const n = Number(e.key);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n - 1 : -1;
}
