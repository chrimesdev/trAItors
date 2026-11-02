/**
 * Talking to an NPC (plan §4.2): chat, seed doubt, ally, bribe.
 * Seeding doubt offers what you actually saw; hold Shift to see the lies.
 */
import { ARCHETYPE_LABEL } from '../app/palette';
import type { GameStore } from '../app/store';
import { greet, playerSawToday, type Command, type GameState, type Id } from '../sim';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';
import { portrait } from './portrait';
import { shift } from './shift';
import { room, who } from './text';

type Step = { kind: 'root' } | { kind: 'doubtTarget' } | { kind: 'doubtClaim'; target: Id };

export interface Talk {
  isOpen(): boolean;
  open(npcId: Id): void;
  render(s: GameState): void;
}

export function mountTalk(overlay: HTMLElement, store: GameStore): Talk {
  const el = document.createElement('div');
  el.className = 'modal panel talk interactive';
  el.hidden = true;
  overlay.appendChild(el);

  let npc: Id | null = null;
  let step: Step = { kind: 'root' };
  let choices: Choice[] = [];
  let greeting = '';

  const close = (): void => {
    el.hidden = true;
    npc = null;
    choices = [];
  };

  const send = (c: Command): void => {
    close();
    store.dispatch(c);
  };

  const draw = (): void => {
    if (!npc) return;
    const s = store.state;
    const n = s.npcs[npc];
    if (!n) return close();
    el.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'talk-head';
    head.appendChild(portrait(s, npc, { showAttitude: true }));
    const intro = document.createElement('div');
    intro.innerHTML = `<h3>${n.name} <span class="muted">· ${ARCHETYPE_LABEL[n.archetype]}</span></h3>`;
    const quote = document.createElement('p');
    quote.className = 'quote';
    quote.textContent = `“${greeting}”`;
    intro.appendChild(quote);
    head.appendChild(intro);
    el.appendChild(head);

    const hint = document.createElement('p');
    hint.className = 'hint';
    el.appendChild(hint);

    const id = npc;
    if (step.kind === 'root') {
      hint.innerHTML = 'Each choice uses an action. <kbd>Esc</kbd> to leave.';
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
      hint.innerHTML = 'Who do you want them to suspect? <kbd>Esc</kbd> to go back.';
      choices = Object.values(s.npcs)
        .filter((x) => x.alive && x.id !== id)
        .map((x) => ({
          label: x.name,
          onPick: () => {
            step = { kind: 'doubtClaim', target: x.id };
            draw();
          },
        }));
    } else {
      const target = step.target;
      const T = who(s, target);
      const saw = playerSawToday(s, target);
      hint.innerHTML = shift.down
        ? '<span class="lying">Lying.</span> Detectives check claims against what they saw.'
        : 'Hold <kbd>Shift</kbd> to lie. <kbd>Esc</kbd> to go back.';
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
        for (const r of Object.keys(s.rooms)) {
          if (saw.includes(r)) continue;
          choices.push({
            label: `“I saw ${T} in the ${room(s, r)}.”`,
            lie: true,
            onPick: () => send({ type: 'seedDoubt', npc: id, target, room: r, isLie: true }),
          });
        }
      }
    }
    renderChoices(el, choices);
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
      el.hidden = false;
      draw();
    },
    render(s) {
      if (!el.hidden && s.phase !== 'day') close();
    },
  };
}
