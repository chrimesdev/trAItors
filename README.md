# Tr<span>AI</span>tors

**Shift the blame. Survive the night shift.**

A single-player social-deduction game for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026) (theme: **SHIFT**), inspired by the TV format _The Traitors_.

You are the only Traitor in a mansion of six AI Faithfuls. By day you roam the rooms, plant evidence, build alibis and seed rumours. At the Round Table the household votes someone out. By night, you kill. Survive to the final three without being banished.

**Shift** is the one key that matters: hold it to sneak through the halls, hold it to lie at the table.

## Play

- Browser build on itch.io: _coming soon_
- Controls: WASD / arrows to move, hold **Shift** to sneak, **E** to act, **1–9** to pick an option
- Add `?seed=123` to the URL to replay a specific game

## Develop

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # simulation unit tests (Vitest)
npm run check      # typecheck + lint + format + tests (what CI runs)
npm run sim -- --seed 42   # headless simulation run
npm run build      # static build in dist/ for itch.io
```

Tagging a commit (`m1`, `m2`, … or `v1.0.0`) publishes a GitHub release with `traitors-html5.zip`, ready to upload to itch.io.

## Project layout

```
src/sim/      pure TypeScript game rules — no Phaser, no DOM, seeded RNG only
src/phaser/   scenes and sprites; renders sim state and sends commands
src/ui/       DOM overlay: HUD, dialogue, trust web, Round Table
src/content/  rooms, NPCs, evidence and dialogue templates as JSON
tests/sim/    Vitest tests for the simulation
docs/         one-pager and full implementation plan (PDF)
```

See [`docs/implementation-plan.pdf`](docs/implementation-plan.pdf) for the full design, data model, rules and milestones, and [`AGENTS.md`](AGENTS.md) for the architecture rules.

## Roadmap

| Milestone | Dates     | Goal                                                  |
| --------- | --------- | ----------------------------------------------------- |
| M0        | 2 Nov     | Tooling, CI, placeholder scene ✅                     |
| M1        | 3–6 Nov   | Simulation core: sightings, evidence, votes, night ✅ |
| M2        | 7–10 Nov  | Mansion scene: tilemap, NPC schedules, sight cones ✅ |
| M3        | 11–16 Nov | Dialogue, rumours, Round Table UI, trust web ✅       |
| M4        | 17–19 Nov | Full loop, win/lose, first playtest                   |
| M5        | 20–23 Nov | Balance and feel                                      |
| M6        | 24–27 Nov | Art, audio, itch.io page                              |
| M7        | 28–29 Nov | Ship (hard deadline 1 Dec 2026, 13:37 PST / 21:37 UK) |

## AI use disclosure

Game Off asks entrants to describe their use of AI. This project uses AI coding assistants for planning, scaffolding and implementation, reviewed by the developer. The in-game "AI" characters are deterministic rule-based agents; no generative AI runs at play time.

## Licence

[MIT](LICENSE)
