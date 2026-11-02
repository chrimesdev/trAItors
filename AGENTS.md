# Working on TrAItors

Instructions for any developer or AI coding assistant working in this repo. The full spec is `docs/implementation-plan.pdf` (sections 1–4 are the source of truth for rules and data model; section 6 lists milestones and their acceptance tests).

## Architecture rules (enforced by ESLint where possible)

1. **`src/sim` is pure TypeScript.** No Phaser, no DOM, no `window`/`document`/`localStorage`, no imports from `src/phaser` or `src/ui`.
2. **All randomness uses `src/sim/rng.ts`.** Never `Math.random()` or `Date.now()` inside `src/sim`. The RNG state lives in `GameState.rng` and is threaded through functions as `[value, nextRng]` tuples.
3. **`applyCommand(state, command)` is pure.** It returns a new `GameState` and never mutates its input. State must survive `JSON.parse(JSON.stringify(state))`.
4. **Every tunable number lives in `src/sim/balance.ts`.** No magic numbers in rule code.
5. **Presentation only renders and sends commands.** `src/phaser` and `src/ui` read state and call `applyCommand`; they contain no game rules.
6. **Content is data.** Rooms, NPCs, evidence and dialogue templates live in `src/content/*.json`.

## Before finishing any change

```bash
npm run check   # typecheck + lint + prettier + vitest
npm run build
```

Add or update Vitest tests in `tests/sim/` for every rule you implement, using the milestone's "Done when" items as test cases.

## Scope

The deadline is **1 December 2026, 13:37 PST**. Do not add features outside the current milestone. The guiding rule: _cut anything that does not change the Round Table._

## Stack

TypeScript 6.0 (pinned below 7 until typescript-eslint supports it), Phaser 4, Vite, Vitest, ESLint flat config, Prettier.
