/** Copying the run report and opening the playtest feedback form. */
import { runReport } from '../app/save';
import type { Command, GameState } from '../sim';

export const REPO_URL = 'https://github.com/chrimesdev/traitors';

/** Copies text to the clipboard; if the browser refuses (e.g. inside an iframe), shows it for manual copying. */
export async function copyOrShow(text: string, fallbackHost: HTMLElement): Promise<'copied' | 'shown'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    let area = fallbackHost.querySelector<HTMLTextAreaElement>('textarea.report');
    if (!area) {
      area = document.createElement('textarea');
      area.className = 'report';
      area.readOnly = true;
      fallbackHost.appendChild(area);
    }
    area.value = text;
    area.focus();
    area.select();
    return 'shown';
  }
}

/** GitHub issue form for playtest feedback, prefilled with this run. */
export function feedbackUrl(s: GameState, commands: readonly Command[]): string {
  // The URL must stay well under browser limits, so send the readable summary and
  // leave the replay data to "Copy run report".
  const report = runReport(s, [...commands]).split('\nReplay data')[0] ?? '';
  const summary = report.length > 5500 ? `${report.slice(0, 5500)}\n…(truncated)` : report;
  const params = new URLSearchParams({
    template: 'playtest.yml',
    title: `Playtest: ${s.outcome ?? 'unfinished'} on day ${s.day} (seed ${s.seed})`,
    report: summary,
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
