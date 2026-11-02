/**
 * Holds the current GameState and is the only place presentation code sends commands.
 * Contains no game rules: it just calls applyCommand and tells subscribers.
 */
import { defaultContent } from '../content';
import { InvalidCommandError, applyCommand, createGame, type Command, type GameState } from '../sim';

export type Listener = (state: GameState, previous: GameState | null) => void;

export class GameStore {
  private current: GameState;
  private readonly listeners = new Set<Listener>();

  constructor(seed: number) {
    this.current = createGame(seed, defaultContent);
  }

  get state(): GameState {
    return this.current;
  }

  /** Applies a command. Returns false (and warns) if the engine rejected it. */
  dispatch(command: Command): boolean {
    try {
      const previous = this.current;
      this.current = applyCommand(previous, command);
      for (const l of this.listeners) l(this.current, previous);
      return true;
    } catch (e) {
      if (e instanceof InvalidCommandError) {
        console.warn(e.message);
        return false;
      }
      throw e;
    }
  }

  newGame(seed: number): void {
    this.current = createGame(seed, defaultContent);
    for (const l of this.listeners) l(this.current, null);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** A seed from the URL (?seed=123) so a run can be shared and replayed; otherwise random. */
export function seedFromUrl(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const n = param === null ? NaN : Number(param);
  return Number.isFinite(n) ? n >>> 0 : Math.floor(Math.random() * 2 ** 31);
}
