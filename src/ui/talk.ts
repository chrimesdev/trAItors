/**
 * Talking to an NPC (plan §4.2): chat, seed doubt, ally, bribe. A dialogue box
 * along the bottom of the map: their portrait, what they say, and your options.
 * After each verb they answer, and you can keep talking while they're still here.
 * Seeding doubt offers what you actually saw; hold Shift to see the lies.
 */
import { ARCHETYPE_LABEL } from '../app/palette';
import type { GameStore } from '../app/store';
import {
  greet,
  npcRoomOf,
  playerSawToday,
  reply,
  roomsPlayerVisitedToday,
  type Command,
  type GameState,
  type Id,
} from '../sim';
import { choiceIndexFromKey, isAdvanceKey, renderChoices, type Choice } from './choices';
import { portrait } from './portrait';
import { shift } from './shift';
import { room, who } from './text';
import { typewriter } from './typewriter';

type Step =
  | { kind: 'root' }
  | { kind: 'doubtTarget' }
  | { kind: 'doubtClaim'; target: Id }
  | { kind: 'reply'; text: string };

export interface Talk {
  isOpen(): boolean;
  open(npcId: Id): void;
  render(s: GameState): void;
}

export function mountTalk(overlay: HTMLElement, store: GameStore): Talk {
  const el = document.createElement('div');
  el.className = 'dialogue talk interactive';
  el.hidden = true;
  el.innerHTML = `
    <div class="slot"></div>
    <div class="body">
      <h3 class="name"></h3>
      <p class="text"></p>
      <p class="hint"></p>
      <div class="options"></div>
    </div>`;
  overlay.appendChild(el);
  const slot = el.querySelector('.slot') as HTMLElement;
  const nameEl = el.querySelector('.name') as HTMLElement;
  const textEl = el.querySelector('.text') as HTMLElement;
  const hintEl = el.querySelector('.hint') as HTMLElement;
  const options = el.querySelector('.options') as HTMLElement;
  const typer = typewriter(textEl);

  let npc: Id | null = null;
  let step: Step = { kind: 'root' };
  let choices: Choice[] = [];
  let greeting = '';
  let spoken = ''; // what is currently in the text box, to avoid retyping on redraw

  const close = (): void => {
    typer.finish();
    el.hidden = true;
    npc = null;
    choices = [];
    spoken = '';
  };

  const say = (text: string): void => {
    if (text === spoken) return;
    spoken = text;
    typer.type(text);
  };

  const stillHere = (s: GameState, id: Id): boolean =>
    s.phase === 'day' && s.npcs[id]?.alive === true && npcRoomOf(s, id) === s.player.room;

  const send = (c: Command): void => {
    if (!store.dispatch(c)) return close();
    step = { kind: 'reply', text: reply(store.state, c) || '…' };
    draw();
  };

  const draw = (): void => {
    if (!npc) return;
    const s = store.state;
    const n = s.npcs[npc];
    if (!n) return close();
    const id = npc;

    slot.innerHTML = '';
    slot.appendChild(portrait(s, id, { showAttitude: true }));
    nameEl.innerHTML = `${n.name} <span class="muted">· ${ARCHETYPE_LABEL[n.archetype]}</span>`;

    if (step.kind === 'root') {
      say(greeting);
      hintEl.innerHTML = 'Each choice uses an action. <kbd>Esc</kbd> to leave.';
      choices = [
        { label: '“What have you noticed today?”', onPick: () => send({ type: 'chat', npc: id }) },
        {
          label: '“I’ve got a bad feeling about someone…”',
          onPick: () => {
            step = { kind: 'doubtTarget' };
            draw();
          },
        },
        { label: '“We should stick together at the table.”', onPick: () => send({ type: 'ally', npc: id }) },
      ];
      if (s.player.bribeTokens > 0) {
        choices.push({
          label: `“Here. For your trouble.” (bribe, ${s.player.bribeTokens} left)`,
          onPick: () => send({ type: 'bribe', npc: id }),
        });
      }
    } else if (step.kind === 'doubtTarget') {
      say('“Go on. Who?”');
      hintEl.innerHTML = 'Who do you want them to suspect? <kbd>Esc</kbd> to go back.';
      choices = Object.values(s.npcs)
        .filter((x) => x.alive && x.id !== id)
        .map((x) => ({
          label: x.name,
          onPick: () => {
            step = { kind: 'doubtClaim', target: x.id };
            draw();
          },
        }));
    } else if (step.kind === 'doubtClaim') {
      const target = step.target;
      const T = who(s, target);
      const saw = playerSawToday(s, target);
      say(`“${T}? What about ${T}?”`);
      hintEl.innerHTML = shift.down
        ? '<span class="lying">Lying.</span> Detectives check claims against what they saw.'
        : 'Hold <kbd>Shift</kbd> to lie about a room you were in. <kbd>Esc</kbd> to go back.';
      choices = [
        {
          label: `“${T} has been acting shifty.”`,
          onPick: () => send({ type: 'seedDoubt', npc: id, target, isLie: false }),
        },
        ...saw.map((r) => ({
          label: `“I saw ${T} in the ${room(s, r)}.”`,
          onPick: () => send({ type: 'seedDoubt', npc: id, target, room: r, isLie: false }),
        })),
      ];
      if (shift.down) {
        // You can only claim to have seen them where you actually were today.
        for (const r of roomsPlayerVisitedToday(s)) {
          if (saw.includes(r)) continue;
          choices.push({
            label: `“I saw ${T} in the ${room(s, r)}.”`,
            lie: true,
            onPick: () => send({ type: 'seedDoubt', npc: id, target, room: r, isLie: true }),
          });
        }
      }
    } else {
      say(step.text);
      const canContinue = stillHere(s, id);
      hintEl.innerHTML = canContinue
        ? '<kbd>Space</kbd> to keep talking · <kbd>Esc</kbd> to leave'
        : `${n.name} moves on. <kbd>Space</kbd> to continue.`;
      choices = canContinue
        ? [
            {
              label: 'Keep talking',
              onPick: () => {
                step = { kind: 'root' };
                greeting = greet(store.state, id);
                spoken = '';
                draw();
              },
            },
            { label: 'Leave', onPick: close },
          ]
        : [{ label: 'Leave', onPick: close }];
    }
    options.innerHTML = '';
    renderChoices(options, choices);
  };

  shift.subscribe(() => {
    if (!el.hidden && step.kind === 'doubtClaim') draw();
  });

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (step.kind === 'doubtClaim') step = { kind: 'doubtTarget' };
      else if (step.kind === 'doubtTarget') step = { kind: 'root' };
      else return close();
      draw();
      return;
    }
    if (isAdvanceKey(e)) {
      e.preventDefault();
      if (!typer.done) typer.finish();
      else if (step.kind === 'reply') choices[0]?.onPick();
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
    open(npcId) {
      npc = npcId;
      step = { kind: 'root' };
      greeting = greet(store.state, npcId);
      spoken = '';
      el.hidden = false;
      draw();
    },
    render(s) {
      if (!el.hidden && s.phase !== 'day') close();
    },
  };
}
