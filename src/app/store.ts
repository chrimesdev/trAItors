/**
 * Holds the current GameState and is the only place presentation code sends commands.
 * Contains no game rules: it calls applyCommand, remembers the commands for
 * save/replay, autosaves, and tells subscribers.
 */
import { defaultContent } from '../content';
import { InvalidCommandError, applyCommand, createGame, type Command, type GameState } from '../sim';
import { clearSave, writeSave, type KeyValueStorage, type SaveFile } from './save';

export type Listener = (state: GameState, previous: GameState | null) => void;

export class GameStore {
  private current: GameState;
  private history: Command[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(
    seed: number,
    private readonly storage: KeyValueStorage | null = null,
  ) {
    this.current = createGame(seed, defaultContent);
  }

  get state(): GameState {
    return this.current;
  }

  /** Every command applied this game, in order. With the seed, this replays the game exactly. */
  get commands(): readonly Command[] {
    return this.history;
  }

  /** Applies a command. Returns false (and warns) if the engine rejected it. */
  dispatch(command: Command): boolean {
    try {
      const previous = this.current;
      this.current = applyCommand(previous, command);
      this.history.push(command);
      writeSave(this.storage, this.current, this.history);
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
    this.history = [];
    writeSave(this.storage, this.current, this.history);
    for (const l of this.listeners) l(this.current, null);
  }

  /** Continues a saved game exactly where it stopped. */
  resume(file: SaveFile): void {
    this.current = file.state;
    this.history = [...file.commands];
    for (const l of this.listeners) l(this.current, null);
  }

  forgetSave(): void {
    clearSave(this.storage);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** A seed from the URL (?seed=123) so a run can be shared and replayed. */
export function seedFromUrl(): number | null {
  const param = new URLSearchParams(window.location.search).get('seed');
  const n = param === null ? NaN : Number(param);
  return Number.isFinite(n) ? n >>> 0 : null;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
