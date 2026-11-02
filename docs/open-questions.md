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

### 4. Is one caught lie fatal?

**Evidence (M3, seed 15):** one lie to Marcus that he disproved at the table, then a true alibi, and the player was banished on day 1 with 5 of 7 votes. The Detective adds +30 and everyone else gets +30 × 0.5 × their trust in him, on top of their own accusations.

**Question:** should getting caught once be a near-certain loss, or a serious setback you can talk your way out of? The show suggests the latter.

**Levers:** `lies.contradictionPenalty`, `evidence.announceFactor`, `roundTable.accuseThreshold`; or let the player answer a contradiction at the table ("I must have been mistaken") at a smaller cost.

### 5. The trust web starts empty

**Evidence (M3):** everyone starts at trust 0, so the web has no lines until after the first vote. The first Round Table, the player's first look at the web, shows nothing.

**Options:** seed small starting trusts from content (e.g. Dalton and Priya are old friends, Theo distrusts the detectives), or seeded jitter like first impressions. Content option also gives NPCs more personality.

### 6. Seeding doubt lists every room as a lie

**Evidence (M3):** with Shift held, the doubt menu lists all ten rooms as lies, which runs past the 1–9 keys. Fine for now; may want to limit to adjacent rooms or the target's own wing once the art pass changes the layout.

## Decided

_Nothing yet._
