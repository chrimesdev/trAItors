# Open questions

Decisions deferred to a later milestone. Each has the evidence so far and the options on the table. Close an item by moving it to **Decided** with the date and what was chosen.

Balance numbers come from `npm run balance` (scripted players over many seeded games). `npm run tune` grid-searches knobs against the targets.

## Still open

_None. Everything below is decided; reopen an item if the playtest says otherwise._

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

### 11. Art and sound are generated in code (2 Nov)

M6 planned a CC0 tileset, sprites, portraits and audio files. Instead everything is drawn or synthesised at runtime: the mansion is painted onto one canvas (`src/phaser/systems/paint.ts`), characters are shape lists (`src/app/art/looks.ts`) that render as both the walking sprite and the SVG portrait, and every sound is WebAudio synthesis (`src/app/audio.ts`). Reasons: no licence or attribution to track, a 1.4 MB build with no asset pipeline, the portraits and sprites can never drift apart, and the AI-use disclosure stays simple. The cost is a less illustrated look than a hand-drawn set would give; revisit only if there is time after M7.

### 12. Browser matrix not yet verified (2 Nov)

Chromium only, through the playtest build. Firefox and Safari (windowed and fullscreen) still need checking by hand before submission: see the checklist in `docs/itch.md`. Watch for WebAudio starting only after a gesture (handled), `roundRect` on canvas (Safari 16+), and fullscreen on the whole document.

### 13. Conversation moved to a bottom dialogue box (2 Nov)

Playtest feedback: things in the right-hand sidebar were being missed. Talking and the room menu now use a RuneScape / Pokémon-style box along the bottom of the map (`src/ui/talk.ts`, `.dialogue` in `styles.css`) with the portrait, the NPC's line typed out, and the options beside it. NPCs now answer every verb in words (`reply()` in `src/sim/dialogue.ts`, lines in `dialogue.json`), and you can keep talking while they are still in the room. World events (someone spots you, a whisper, a glance) also appear as subtitles at the bottom (`src/ui/captions.ts`); the sidebar feed stays as the history. The chat reveal card in the sidebar is gone: what they said is in the reply and in the log.

The floor plan (`mansion.json`) was redrawn with varied room sizes and more furniture, keeping the same adjacency. Evidence items have drawn icons.

### 3. Action budget vs. map size → keep 6 (2 Nov)

Scarcity is the point: choosing where to spend the day is the main decision, and the balance targets were tuned at 6. The redrawn floor plan keeps the same adjacency, so distances are unchanged. Revisit only if playtesters say the day feels too short rather than too tight.

### 4. One caught lie is answerable, not fatal (2 Nov)

When a Detective disproves a rumour you seeded, the Round Table pauses for your answer before your statement:

- **"I must have been mistaken."** The penalty is halved (`lies.retractFactor` 0.5), the story is withdrawn from everyone who heard it (their suspicion of the target drops back), and the Detective trusts you less (`lies.retractTrustLoss` −0.2).
- **"I know what I saw."** Full penalty, as before, but the rumour stands.

Bots and old saves default to standing by it, so the balance sweep is unchanged by this rule alone. Recorded in `TableRecord.answer`.

### 5. The trust web starts with relationships (2 Nov)

`npcs.json` now carries starting `trusts`: Dalton and Priya are old friends (+0.4 each way), Priya looks up to Marcus, Theo distrusts both detectives, Imogen resents Marcus, Rosa admires him. The web has lines from the first Round Table, and the relationships colour how rumours travel (influence uses trust).

### 6. Lies are limited to rooms you were in (2 Nov)

"I saw X in the R" is only offered, and only accepted by the engine, for rooms you visited today. Truthful options are rooms you actually shared with the target; the lies are the rest of your own route. The menu stays within the 1–9 keys and your story stays consistent with your own alibi.

### 8. A gentler first day (2 Nov)

On day 1 only: NPCs need `firstDay.playerAccuseThresholdBonus` (15) more suspicion before they accuse the player out loud, being seen picking up or planting costs `firstDay.witnessFactor` (0.5) of the usual penalty, and an NPC only votes for the player if their suspicion is at least `firstDay.playerVoteFloor` (25); below that they vote for their top Faithful suspect. The floor was added after a browser run where a retracted lie plus silence still lost 5–1 on day 1 with everyone's suspicion around 20: NPCs always vote for their top suspect, and a few points were enough. Day 2 onwards is unchanged. Measured with `npm run balance` (400 games per bot): the accusation bonus and witness factor alone barely moved the random bot (day-1 losses 176 → 172), because votes, not accusations, decide the table. The vote floor is what changes it: day-1 losses fall to **9 of 400**, the naive win rate rises from 11% to **16%** (target ~25%), idle still loses (1.5%, now on day 2) and careful is unchanged at **55%**. Measure the real effect on people in the playtest.

### 14. No sidebar: the HUD lives on the map (2 Nov)

Playtest feedback again: the sidebar felt separate and was missed. The canvas is now the whole frame (960 × 528) and the HUD sits in the corners of the map: day and the cast as small portraits top-left (dimmed when gone), action stars top-right that turn red and pulse on the last two, a SNEAKING tag while Shift is held, an equipped-item slot bottom-right with the drawn icon and who it points at, and a context prompt bottom-left saying what E does in this room. First-day tips are a one-line strip at the top. The event feed is gone: live events are subtitles, and the history is under *What happened so far* in the pause menu.

The Round Table is a candle-lit room: vignette, a wooden table ringed by flickering candles, portraits lit warm with the speaker brought forward beside the speech, serif narration that sets the scene each night (`narration` in `dialogue.json`, `narrate()` in the sim), and more varied accusation and alibi lines.

