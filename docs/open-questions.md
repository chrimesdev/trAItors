# Open questions

Decisions deferred to a later milestone. Each has the evidence so far and the options on the table. Close an item by moving it to **Decided** with the date and what was chosen.

## For M5 (balance & feel)

### 1. Games are too short

**Evidence (M1, 2 Nov):** each day removes two Faithfuls (one banished, one murdered). With 6 NPCs and `faithfulsLeftToWin: 2`, a game lasts about 2 days; `maxDays: 6` never triggers. `npm run sim -- --runs 1000` → average length **1.87 days**.

**Options:**

- **A. 8 NPCs instead of 6.** Adds a third day and more social surface. Costs two more characters (schedules, dialogue, portraits, sprites).
- **B. Win at 1 Faithful left** (`faithfulsLeftToWin: 1`). Roughly one more day. No new content.
- **C. Murder is optional each night.** Closest to the TV show; lets the player lie low; lengthens the game most. Adds a "spare them tonight" choice to the night screen.
- Combinations, e.g. B + C.

**Leaning:** C, possibly with B.

### 2. Win rate is too high for a careless player

**Evidence (M1):** the naive bot (random legal moves, quiet at the table, random votes) wins **60.2%** of 1000 games. Plan target: naive ≈ 25%, careful ≈ 55%.

**Likely levers** (all in `src/sim/balance.ts`): tie-break and first-impression jitter, `accuseThreshold`, body-room penalties, detection chances, number of Faithfuls. Depends heavily on question 1, so settle that first.

**Needed first:** a "careful" bot (sneaks, plants away from witnesses, accuses with evidence) so both targets can be measured.

### 3. Action budget vs. map size

**Evidence:** every room change costs one of six actions. Hall → Cellar is three moves, so a cross-mansion plant can take the whole day.

**Options:** keep (scarcity is the point), raise `actionBudget`, or make moving within a wing free. Revisit after first playtest (M4).

## Decided

_Nothing yet._
