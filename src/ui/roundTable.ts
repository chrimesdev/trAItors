/**
 * The Round Table screen (plan M3): portraits in a ring over the trust web,
 * speeches typed out one by one, your statement (hold Shift to lie about your
 * alibi), your vote, then the reveal: reactions, votes landing, the banishment,
 * and the trust web redrawing.
 */
import { audio } from '../app/audio';
import type { GameStore } from '../app/store';
import {
  PLAYER_ID,
  narrate,
  roomsPlayerVisitedToday,
  roundTableSpeeches,
  speak,
  type GameState,
  type Id,
  type LieAnswer,
  type PlayerStatement,
} from '../sim';
import { choiceIndexFromKey, isAdvanceKey, renderChoices, type Choice } from './choices';
import { portrait } from './portrait';
import { shift } from './shift';
import { room, who } from './text';
import { createTrustWeb, drawTrustWeb, type Seat } from './trustWeb';

interface Line {
  speaker: Id | null;
  text: string;
}

type Step =
  | 'speeches'
  | 'answer'
  | 'statement'
  | 'accuseTarget'
  | 'defendTarget'
  | 'alibiRoom'
  | 'vote'
  | 'reactions'
  | 'votes'
  | 'verdict';

const TYPE_MS = 16;
const VOTE_MS = 550;

export interface RoundTable {
  isOpen(): boolean;
  render(s: GameState, prev: GameState | null): void;
}

export function describeStatement(s: GameState, st: PlayerStatement): string {
  switch (st.kind) {
    case 'quiet':
      return 'You keep your head down and say nothing.';
    case 'accuse':
      return `You point across the table. “It’s ${who(s, st.target)}. I’m sure of it.”`;
    case 'defend':
      return `“Leave ${who(s, st.target)} alone. I trust them.”`;
    case 'alibi':
      return `“For what it’s worth, I was in the ${room(s, st.room)}.”`;
  }
}

export function mountRoundTable(overlay: HTMLElement, store: GameStore, onClose: () => void): RoundTable {
  const el = document.createElement('div');
  el.className = 'screen table-screen interactive';
  el.hidden = true;
  el.innerHTML = `
    <h2 class="screen-title"></h2>
    <div class="ring"></div>
    <div class="speech"><div class="speech-face"></div><div class="speech-body"><div class="speaker"></div><div class="text"></div></div></div>
    <div class="controls"></div>
  `;
  overlay.appendChild(el);
  const title = el.querySelector('.screen-title') as HTMLElement;
  const ring = el.querySelector('.ring') as HTMLElement;
  const speakerEl = el.querySelector('.speaker') as HTMLElement;
  const faceEl = el.querySelector('.speech-face') as HTMLElement;
  const textEl = el.querySelector('.text') as HTMLElement;
  const controls = el.querySelector('.controls') as HTMLElement;
  const web = createTrustWeb();

  let openDay = 0;
  let step: Step = 'speeches';
  let seats: Seat[] = [];
  let lines: Line[] = [];
  let lineIndex = 0;
  let typing: number | null = null;
  let typedFull = true;
  let statement: PlayerStatement = { kind: 'quiet' };
  let answer: LieAnswer | undefined;
  let caught: Id[] = []; // Detectives who called out a lie this table
  let view: GameState | null = null; // the state the ring is showing
  let choices: Choice[] = [];
  let voteTimer: number | null = null;

  // ---------------------------------------------------------------- ring

  const buildRing = (s: GameState): void => {
    ring.innerHTML = '';
    const candles = document.createElement('div');
    candles.className = 'candles';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const c = document.createElement('span');
      c.className = 'candle';
      c.style.left = `${50 + Math.cos(a) * 21}%`;
      c.style.top = `${50 + Math.sin(a) * 22}%`;
      c.style.setProperty('--d', `${(i * 0.37) % 1.3}s`);
      candles.appendChild(c);
    }
    ring.appendChild(candles);
    ring.appendChild(web);
    web.innerHTML = '';
    const ids = [
      PLAYER_ID,
      ...Object.values(s.npcs)
        .filter((n) => n.alive)
        .map((n) => n.id),
    ];
    // Player sits at the bottom; everyone else around the ellipse.
    seats = ids.map((id, i) => {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / ids.length;
      return { id, x: 50 + Math.cos(a) * 40, y: 50 + Math.sin(a) * 38 };
    });
    for (const seat of seats) {
      const p = portrait(s, seat.id, { showAttitude: true });
      p.style.left = `${seat.x}%`;
      p.style.top = `${seat.y}%`;
      const chips = document.createElement('div');
      chips.className = 'chips';
      p.appendChild(chips);
      ring.appendChild(p);
    }
    drawTrustWeb(web, s, seats);
  };

  const seatEl = (id: Id): HTMLElement | null => ring.querySelector(`.portrait[data-id="${id}"]`);

  const highlight = (id: Id | null): void => {
    for (const p of ring.querySelectorAll('.portrait')) p.classList.remove('speaking');
    if (id) seatEl(id)?.classList.add('speaking');
  };

  // ---------------------------------------------------------------- typing

  const stopTyping = (): void => {
    if (typing !== null) window.clearInterval(typing);
    typing = null;
  };

  const showFace = (id: Id | null): void => {
    faceEl.innerHTML = '';
    faceEl.classList.toggle('narrator', !id);
    if (id) faceEl.appendChild(portrait(view as GameState, id));
  };

  const showLine = (line: Line): void => {
    stopTyping();
    const s = view as GameState;
    speakerEl.textContent = line.speaker ? (line.speaker === PLAYER_ID ? 'You' : who(s, line.speaker)) : '';
    el.classList.toggle('narrating', !line.speaker);
    showFace(line.speaker);
    highlight(line.speaker);
    textEl.textContent = '';
    typedFull = false;
    let i = 0;
    typing = window.setInterval(() => {
      i += 2;
      textEl.textContent = line.text.slice(0, i);
      if (i >= line.text.length) {
        stopTyping();
        typedFull = true;
      }
    }, TYPE_MS);
  };

  const finishTyping = (): void => {
    stopTyping();
    const line = lines[lineIndex];
    if (line) textEl.textContent = line.text;
    typedFull = true;
  };

  /** Space/Enter/click during speeches or reactions. */
  const advance = (): void => {
    if (!typedFull) return finishTyping();
    lineIndex++;
    const line = lines[lineIndex];
    if (line) return showLine(line);
    if (step === 'speeches') goto(caught.length && !answer ? 'answer' : 'statement');
    else if (step === 'reactions') goto('votes');
  };

  // ---------------------------------------------------------------- steps

  const setControls = (hint: string, list: Choice[]): void => {
    controls.innerHTML = hint ? `<p class="hint">${hint}</p>` : '';
    choices = list;
    if (list.length) renderChoices(controls, list);
  };

  const living = (s: GameState) => Object.values(s.npcs).filter((n) => n.alive);

  const goto = (next: Step): void => {
    step = next;
    const s = store.state;
    switch (next) {
      case 'speeches':
        setControls('<kbd>Space</kbd> to continue', []);
        lineIndex = 0;
        showLine(lines[0] as Line);
        break;
      case 'answer': {
        highlight(PLAYER_ID);
        showFace(PLAYER_ID);
        el.classList.remove('narrating');
        speakerEl.textContent = 'Your answer';
        const names = caught.map((id) => who(s, id)).join(' and ');
        textEl.textContent = `${names} ${caught.length === 1 ? 'has' : 'have'} called out something you said today. The table waits.`;
        setControls(
          'Hold <kbd>Shift</kbd> to lie at the table later; this one is about what you already said.',
          [
            {
              label: '“I must have been mistaken.” · half the damage, but the story dies',
              onPick: () => ((answer = 'retract'), goto('statement')),
            },
            {
              label: '“I know what I saw.” · full damage, the rumour stands',
              onPick: () => ((answer = 'standBy'), goto('statement')),
            },
          ],
        );
        break;
      }
      case 'statement':
        highlight(PLAYER_ID);
        showFace(PLAYER_ID);
        el.classList.remove('narrating');
        speakerEl.textContent = 'Your turn';
        textEl.textContent = 'The table turns to you.';
        setControls('', [
          { label: 'Accuse someone', onPick: () => goto('accuseTarget') },
          { label: 'Defend someone', onPick: () => goto('defendTarget') },
          { label: 'Give your alibi', onPick: () => goto('alibiRoom') },
          { label: 'Stay quiet', onPick: () => ((statement = { kind: 'quiet' }), goto('vote')) },
        ]);
        break;
      case 'accuseTarget':
      case 'defendTarget': {
        const kind = next === 'accuseTarget' ? 'accuse' : 'defend';
        setControls(
          `${kind === 'accuse' ? 'Accuse' : 'Defend'} whom? <kbd>Esc</kbd> to go back.`,
          living(s).map((n) => ({
            label: n.name,
            onPick: () => {
              statement = { kind, target: n.id, isLie: false };
              goto('vote');
            },
          })),
        );
        break;
      }
      case 'alibiRoom': {
        const visited = roomsPlayerVisitedToday(s);
        const list: Choice[] = visited.map((r) => ({
          label: `“I was in the ${room(s, r)}.”`,
          onPick: () => ((statement = { kind: 'alibi', room: r, isLie: false }), goto('vote')),
        }));
        if (shift.down) {
          for (const r of Object.keys(s.rooms)) {
            if (visited.includes(r)) continue;
            list.push({
              label: `“I was in the ${room(s, r)}.”`,
              lie: true,
              onPick: () => ((statement = { kind: 'alibi', room: r, isLie: true }), goto('vote')),
            });
          }
        }
        setControls(
          shift.down
            ? '<span class="lying">Lying.</span> If a Detective watched you all day, they’ll know.'
            : 'Where were you? Hold <kbd>Shift</kbd> to lie. <kbd>Esc</kbd> to go back.',
          list,
        );
        break;
      }
      case 'vote':
        speakerEl.textContent = 'Your vote';
        textEl.textContent = describeStatement(s, statement);
        setControls(
          'Who do you vote to banish? <kbd>Esc</kbd> to change what you said.',
          living(s).map((n) => ({ label: `Banish ${n.name}`, onPick: () => resolve(n.id) })),
        );
        break;
      case 'reactions':
        setControls('<kbd>Space</kbd> to continue', []);
        lineIndex = 0;
        showLine(lines[0] as Line);
        break;
      case 'votes':
        revealVotes();
        break;
      case 'verdict':
        showVerdict();
        break;
    }
  };

  const resolve = (vote: Id): void => {
    const before = store.state;
    if (
      !store.dispatch({
        type: 'resolveRoundTable',
        playerVote: vote,
        statement,
        ...(answer ? { answer } : {}),
      })
    )
      return;
    const after = store.state;
    view = after;
    const record = after.lastTable;
    lines = [
      ...(answer
        ? [
            {
              speaker: PLAYER_ID,
              text: answer === 'retract' ? '“I must have been mistaken about that.”' : '“I know what I saw.”',
            },
          ]
        : []),
      ...(record?.reactions ?? [])
        .filter((r) => r.kind === 'lieRetracted' || r.kind === 'lieStoodBy')
        .map((r) => ({ speaker: r.speaker, text: speak(after, r) })),
      { speaker: PLAYER_ID, text: describeStatement(before, statement) },
      ...(record?.reactions ?? [])
        .filter((r) => r.kind !== 'lieRetracted' && r.kind !== 'lieStoodBy')
        .map((r) => ({ speaker: r.speaker, text: speak(after, r) })),
    ];
    goto('reactions');
  };

  const revealVotes = (): void => {
    const s = view as GameState;
    const votes = Object.entries(s.lastTable?.votes ?? {});
    speakerEl.textContent = 'The vote';
    textEl.textContent = narrate(s, 'vote');
    showFace(null);
    el.classList.add('narrating');
    highlight(null);
    setControls('', []);
    audio.play('drumroll');
    let i = 0;
    const tick = (): void => {
      const entry = votes[i];
      if (!entry) {
        voteTimer = null;
        goto('verdict');
        return;
      }
      const [voter, target] = entry;
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = voter === PLAYER_ID ? 'You' : who(s, voter).charAt(0);
      chip.title = `${voter === PLAYER_ID ? 'You' : who(s, voter)} voted for ${who(s, target)}`;
      seatEl(target)?.querySelector('.chips')?.appendChild(chip);
      audio.play('tick');
      textEl.textContent = `${voter === PLAYER_ID ? 'You vote' : `${who(s, voter)} votes`} for ${who(s, target)}.`;
      i++;
      voteTimer = window.setTimeout(tick, VOTE_MS);
    };
    tick();
  };

  const showVerdict = (): void => {
    const s = view as GameState;
    const banished = s.lastTable?.banished;
    if (!banished) return close();
    seatEl(banished)?.classList.add('banished');
    highlight(banished);
    showFace(banished);
    el.classList.remove('narrating');
    audio.play('banish');
    drawTrustWeb(web, s, seats);
    if (banished === PLAYER_ID) {
      speakerEl.textContent = 'Banished';
      textEl.textContent = 'The table has spoken. You are banished, and you were the Traitor.';
    } else {
      speakerEl.textContent = 'Banished';
      textEl.textContent = `${who(s, banished)} is banished. They were a Faithful.`;
    }
    setControls('Watch the trust web shift. <kbd>Space</kbd> to continue', [
      { label: s.phase === 'night' ? 'Into the night…' : 'Continue', onPick: () => close() },
    ]);
  };

  // ---------------------------------------------------------------- open/close

  const open = (s: GameState): void => {
    openDay = s.day;
    view = s;
    statement = { kind: 'quiet' };
    answer = undefined;
    title.innerHTML = `The Round Table <span class="muted">· Day ${s.day}</span>`;
    buildRing(s);
    const speeches = roundTableSpeeches(s);
    caught = [...new Set(speeches.filter((sp) => sp.kind === 'contradiction').map((sp) => sp.speaker))];
    lines = [
      { speaker: null, text: narrate(s, 'open') },
      ...(speeches.length
        ? speeches.map((sp) => ({ speaker: sp.speaker, text: speak(s, sp) }))
        : [{ speaker: null, text: narrate(s, 'silence') }]),
    ];
    el.hidden = false;
    goto('speeches');
  };

  const close = (): void => {
    stopTyping();
    if (voteTimer !== null) window.clearTimeout(voteTimer);
    voteTimer = null;
    el.hidden = true;
    onClose();
  };

  // ---------------------------------------------------------------- input

  shift.subscribe(() => {
    if (!el.hidden && step === 'alibiRoom') goto('alibiRoom');
  });

  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (step === 'speeches' || step === 'reactions') advance();
  });

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if (isAdvanceKey(e)) {
      e.preventDefault();
      if (step === 'speeches' || step === 'reactions') advance();
      else if (step === 'verdict') close();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (step === 'accuseTarget' || step === 'defendTarget' || step === 'alibiRoom' || step === 'vote') {
        goto('statement');
      } else if (step === 'statement' && caught.length) {
        answer = undefined;
        goto('answer');
      }
      return;
    }
    const i = choiceIndexFromKey(e);
    if (i >= 0) {
      e.preventDefault();
      choices[i]?.onPick();
    }
  });

  return {
    isOpen: () => !el.hidden,
    render(s, prev) {
      if (prev === null) openDay = 0; // new game
      if (el.hidden && s.phase === 'roundTable' && openDay !== s.day) open(s);
    },
  };
}
