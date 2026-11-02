# Open questions

Decisions deferred to a later milestone. Each has the evidence so far and the options on the table. Close an item by moving it to **Decided** with the date and what was chosen.

Balance numbers come from `npm run balance` (scripted players over many seeded games). `npm run tune` grid-searches knobs against the targets.

## Still open

### 3. Action budget vs. map size

**Evidence:** every room change costs one of six actions. Hall → Cellar is three moves, so a cross-mansion plant can take the whole day.

**Options:** keep (scarcity is the point), raise `actionBudget`, or make moving within a wing free. **Revisit after the first playtest.**

### 4. Is one caught lie fatal?

**Evidence (M3, seed 15):** one lie to Marcus that he disproved at the table, then a true alibi, and the player was banished on day 1 with 5 of 7 votes. The Detective adds +30 and everyone else gets +30 × 0.5 × their trust in him, on top of their own accusations. Not yet measured at scale: the careful bot never lies.

**Question:** should getting caught once be a near-certain loss, or a serious setback you can talk your way out of? The show suggests the latter.

**Levers:** `lies.contradictionPenalty`, `evidence.announceFactor`, `roundTable.accuseThreshold`; or let the player answer a contradiction at the table ("I must have been mistaken") at a smaller cost. **Next step:** a "liar" bot to measure it.

### 5. The trust web starts empty

**Evidence (M3):** everyone starts at trust 0, so the web has no lines until after the first vote. The first Round Table, the player's first look at the web, shows nothing.

**Options:** seed small starting trusts from content (e.g. Dalton and Priya are old friends, Theo distrusts the detectives), or seeded jitter like first impressions. Content option also gives NPCs more personality.

### 6. Seeding doubt lists every room as a lie

**Evidence (M3):** with Shift held, the doubt menu lists all ten rooms as lies, which runs past the 1–9 keys. Fine for now; may want to limit to adjacent rooms or the target's own wing once the art pass changes the layout.

### 8. Do new players get banished too early?

**Evidence (M5, 1000 games):** the random-move bot is banished on **day 1 in 41%** of games, mostly from planting or picking up evidence in front of people, lies that get caught, and bribes that get exposed. Those are the player's own mistakes and the end screen explains them, but losing within five minutes might put playtesters off.

**Watch in the playtest:** how many testers lose on day 1, and whether the end screen made the reason clear. If too many, options are a gentler day 1 (e.g. NPCs don't accuse below a higher threshold on day 1) or a scripted tutorial day.

## Decided

### 1. Games are too short → B: final three (2 Nov)

`day.faithfulsLeftToWin` is now **1**: you win when one Faithful is left, which makes day 3 a three-person showdown at the Round Table. A well-played game now lasts **2.9 days** (was 2.0). A (8 NPCs) is more content than the deadline allows; C (optional murders) is unnecessary for length now and remains a possible addition if games feel samey.

### 2 & 7. Too easy, and doing nothing wins → four pressure rules (2 Nov)

Measured with three scripted players over 1000 games each:

| Player                                                      | Before | After     | Target |
| ----------------------------------------------------------- | ------ | --------- | ------ |
| **Idle**: never acts, stays quiet                           | 49%    | **0.8%**  | low    |
| **Naive**: random legal actions                             | 62%    | **11%**   | ~25%   |
| **Careful**: frames a scapegoat, plants unseen, kills risks | 98%    | **53.5%** | ~55%   |

New rules (all in `balance.pressure`, values chosen by `npm run tune`):

- **Silence is noticed:** staying quiet at the table adds suspicion, and someone says so (`quietPenalty` 2).
- **Keeping to yourself:** each Faithful you didn't speak to today trusts you a little less (`isolationPenalty` 1).
- **The dead remember:** survivors suspect whoever the victim suspected, shown on the morning card (`victimLeadPenalty` 8). Killing whoever is onto you now points at you.
- **Pushing an innocent:** accusing or voting out someone who turns out Faithful costs credibility (`pushedInnocentPenalty` 6, `wrongVotePenalty` 2). Applies to NPCs too.

Naive is below its target, but the bot is cruder than a real first-timer: it never speaks up at the table and plants in front of witnesses. See #8. `tests/sim/balance.test.ts` keeps these within wide bands so later changes can't silently break the difficulty.

### 9. Tutorial day → a coached day 1, not a sim "day 0" (2 Nov)

The plan's M5 asks for a scripted day 0 that forces one plant and one sneak. A separate day in the simulation would touch the reducer, win checks, saves, replays and every bot for a day whose outcome doesn't change the Round Table. Instead the first real day is coached: a sidebar card (`src/ui/coach.ts`) walks the player through **sneak → pick up → plant → talk**, each step ticked off from the commands already sent, and "Wait for the bell" stays hidden until the plant is done. It survives save/resume, costs nothing in the sim, and the careful bot shows this is the strongest opening anyway. Shown until completed once or hidden; the pause menu toggles **First-day tips**. Revisit after the playtest if testers still lose on day 1 (#8).

### 10. Tells (2 Nov)

Two tells so playtesters can name why they were suspected (M5 "Done when"):

- **Glances.** An NPC whose suspicion of you is at least `tells.glanceSuspicion` (35) is _wary_: their name turns red while you share a room, every few seconds their sight cone turns to look straight at you, and the log notes it when they see you arrive or walk in on you. A glance that lands on you is a real sighting, so being suspected makes it harder to move unseen: the pressure is intentional.
- **Whispers.** Rumours passed NPC to NPC float up as italic text between the two of them, red when they're about you. In your own room the log also says what you overheard. Only player-seeded rumours exist today, so every whisper is your own doubt spreading.

