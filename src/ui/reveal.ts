/** Top-right card showing what you learned from the last chat. */
import type { GameState } from '../sim';
import { room, who } from './text';

export function mountReveal(overlay: HTMLElement): { render(s: GameState): void } {
  const el = document.createElement('div');
  el.className = 'reveal panel';
  el.hidden = true;
  overlay.appendChild(el);

  return {
    render(s) {
      const r = s.lastReveal;
      if (!r || s.phase !== 'day') {
        el.hidden = true;
        return;
      }
      const suspects = r.suspects.map((id) => who(s, id)).join(' and ') || 'nobody in particular';
      const seen = r.sightings.length
        ? r.sightings.map((m) => `${who(s, m.subject)} in the ${room(s, m.room)}`).join('; ')
        : 'nothing worth mentioning';
      el.innerHTML = `
        <h4>${who(s, r.npc)} <span class="attitude-${r.attitude}">· ${r.attitude} toward you</span></h4>
        <div>Suspects <b>${suspects}</b>.</div>
        <div>Saw ${seen}.</div>
      `;
      el.hidden = false;
    },
  };
}
