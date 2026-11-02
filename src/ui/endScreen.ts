/**
 * End of game: the verdict, a day-by-day replay of every vote and murder, and
 * the reveal the player never sees during play: how much each Faithful suspected
 * them, how often they were seen, and which lies were caught.
 */
import { runReport } from '../app/save';
import type { GameStore } from '../app/store';
import { PLAYER_ID, type GameState } from '../sim';
import { choiceIndexFromKey, renderChoices, type Choice } from './choices';
import { copyOrShow, feedbackUrl } from './report';
import { room, who } from './text';

export interface EndScreen {
  isOpen(): boolean;
  render(s: GameState, prev: GameState | null): void;
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

function replayHtml(s: GameState): string {
  const days = Math.max(s.history.tables.length, s.history.murders.length);
  const rows: string[] = [];
  for (let d = 1; d <= days; d++) {
    const t = s.history.tables.find((x) => x.day === d);
    const m = s.history.murders.find((x) => x.day === d);
    const parts: string[] = [];
    if (t) {
      const st = t.statement;
      const said =
        st.kind === 'quiet'
          ? 'You stayed quiet.'
          : st.kind === 'alibi'
            ? `You claimed the ${room(s, st.room)}${st.isLie ? ' <span class="lie-tag">LIE</span>' : ''}.`
            : `You ${st.kind === 'accuse' ? 'accused' : 'defended'} ${who(s, st.target)}.`;
      const votes = Object.entries(t.votes)
        .map(
          ([voter, target]) =>
            `<span class="vote${target === PLAYER_ID ? ' at-you' : ''}">${esc(voter === PLAYER_ID ? 'You' : who(s, voter))} → ${esc(target === PLAYER_ID ? 'you' : who(s, target))}</span>`,
        )
        .join('');
      const out =
        t.banished === PLAYER_ID
          ? '<b class="lying">You</b> were banished'
          : `<b>${esc(who(s, t.banished))}</b> was banished`;
      parts.push(`<div>${out}. ${said}</div><div class="votes">${votes}</div>`);
    }
    if (m)
      parts.push(
        `<div class="murder">Night: you murdered ${esc(who(s, m.victim))} in the ${esc(room(s, m.room))}.</div>`,
      );
    rows.push(`<li><span class="day">Day ${d}</span>${parts.join('')}</li>`);
  }
  return `<ol class="replay">${rows.join('')}</ol>`;
}

function revealHtml(s: GameState): string {
  const rows = Object.values(s.npcs)
    .map((n) => {
      const v = Math.round(n.suspicion[PLAYER_ID] ?? 0);
      const seen = n.memory.filter((m) => m.subject === PLAYER_ID).length;
      return `<div class="bar-row${n.alive ? '' : ' gone'}">
        <span class="who">${esc(n.name)}</span>
        <span class="bar"><span style="width:${v}%"></span></span>
        <span class="num">${v}</span>
        <span class="seen">saw you ${seen}×</span></div>`;
    })
    .join('');
  const lies = s.player.lies
    .map(
      (l) =>
        `<li>${esc(l.claim)}${l.contradictedBy ? ` <span class="lying">caught by ${esc(who(s, l.contradictedBy))}</span>` : ' <span class="muted">got away with it</span>'}</li>`,
    )
    .join('');
  return `
    <h4>How much they suspected you</h4>${rows}
    <h4>Your lies</h4>${lies ? `<ul>${lies}</ul>` : '<p class="muted">You didn’t tell a single lie.</p>'}`;
}

export function mountEndScreen(
  overlay: HTMLElement,
  store: GameStore,
  deps: { blocked: () => boolean; newSeed: () => number; toTitle: () => void },
): EndScreen {
  const el = document.createElement('div');
  el.className = 'screen end-screen interactive';
  el.hidden = true;
  overlay.appendChild(el);
  let choices: Choice[] = [];

  const close = (): void => {
    el.hidden = true;
  };

  const draw = (s: GameState): void => {
    const won = s.outcome === 'win';
    el.innerHTML = `
      <h2 class="screen-title">${won ? 'The Traitor wins' : 'Banished'} <span class="muted">· day ${s.day} · seed ${s.seed}</span></h2>
      <p class="hint">${won ? 'The Faithfuls never worked it out.' : 'The Faithfuls saw through you.'}</p>
      <div class="end-cols"><div>${replayHtml(s)}</div><div class="reveal-col">${revealHtml(s)}</div></div>
      <div class="end-actions"></div>`;
    const actions = el.querySelector('.end-actions') as HTMLElement;
    const status = document.createElement('p');
    status.className = 'hint';
    choices = [
      { label: 'Play again', onPick: () => (close(), store.newGame(deps.newSeed())) },
      { label: `Replay seed ${s.seed}`, onPick: () => (close(), store.newGame(s.seed)) },
      {
        label: 'Copy run report',
        onPick: () => {
          void copyOrShow(runReport(s, [...store.commands]), actions).then((how) => {
            status.textContent =
              how === 'copied'
                ? 'Run report copied to your clipboard.'
                : 'Select the text below and copy it.';
          });
        },
      },
      {
        label: 'Send playtest feedback',
        onPick: () => window.open(feedbackUrl(s, store.commands), '_blank', 'noopener'),
      },
      { label: 'Title screen', onPick: () => (close(), deps.toTitle()) },
    ];
    renderChoices(actions, choices);
    actions.appendChild(status);
    el.scrollTop = 0;
  };

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.defaultPrevented) return;
    const i = choiceIndexFromKey(e);
    if (i >= 0) {
      e.preventDefault();
      choices[i]?.onPick();
    }
  });

  return {
    isOpen: () => !el.hidden,
    render(s) {
      if (s.phase !== 'ended') return close();
      if (el.hidden && !deps.blocked()) {
        el.hidden = false;
        draw(s);
      }
    },
  };
}
