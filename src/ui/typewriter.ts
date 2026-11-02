/** Types text into an element a couple of characters at a time. Shared by the talk box and the Round Table. */
export interface Typewriter {
  type(text: string): void;
  finish(): void;
  readonly done: boolean;
}

export function typewriter(el: HTMLElement, msPerStep = 16): Typewriter {
  let timer: number | null = null;
  let full = '';
  let done = true;
  const stop = (): void => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
  return {
    get done() {
      return done;
    },
    type(text) {
      stop();
      full = text;
      done = false;
      el.textContent = '';
      let i = 0;
      timer = window.setInterval(() => {
        i += 2;
        el.textContent = full.slice(0, i);
        if (i >= full.length) {
          stop();
          done = true;
        }
      }, msPerStep);
    },
    finish() {
      stop();
      el.textContent = full;
      done = true;
    },
  };
}
