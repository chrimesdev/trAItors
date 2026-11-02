# itch.io page kit (M6)

Everything needed to set up the itch.io page and submit to Game Off 2026. Assets live in `docs/press/`.

## Project settings

| Setting                 | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Title                   | TrAItors                                                                             |
| Short description       | Shift the blame. Survive the night shift. A one-player social-deduction game.        |
| Kind of project         | HTML                                                                                 |
| Upload                  | `traitors-html5.zip` from the GitHub release for the `v1.0.0` tag (`npm run build`)  |
| Embed                   | Viewport **960 × 528**, _Fullscreen button_ on, _Mobile friendly_ off               |
| Classification          | Game · Genre: Strategy, Simulation · Tags: social-deduction, stealth, singleplayer   |
| Pricing                 | No payments                                                                          |
| Cover image             | `docs/press/cover.png` (630 × 500)                                                   |
| Screenshots             | `docs/press/mansion.png`, `docs/press/round-table.png`, `docs/press/night.png`       |
| GIF                     | `docs/press/sneak.gif` (see below)                                                   |

## Description (paste into the page)

You are the only **Traitor** in a mansion of six AI Faithfuls, in the spirit of the TV show. By day you roam the rooms under their sight cones, plant evidence, build alibis and seed rumours. At the **Round Table** the household argues, accuses and votes someone out. By night, you kill. Survive to the final showdown without being banished.

**SHIFT** is the one key that matters:

- Hold **Shift** to sneak through the house. Slower, but they might not see you.
- Hold **Shift** to lie. In conversation and at the table, the false options appear only while Shift is down. Detectives check what you say against what they saw.
- **Shift the blame.** Evidence found in a room incriminates its owner. Unless someone saw you plant it.
- **Shifting alliances.** The trust web between portraits redraws after every vote.

Every Faithful has a personality: the Detective remembers everything, the Follower agrees with the room, the Loyalist defends their ally, the Grudge-holder votes for whoever accused them, the Paranoid suspects whoever is defended most. Nothing is scripted and no generative AI runs at play time: they are deterministic rule-based agents, and the same seed with the same choices always plays out the same way.

A game takes about 10–15 minutes. Add `?seed=123` to the URL to replay a specific game.

## Controls

- **WASD** / arrow keys: move
- **Shift** (hold): sneak, or lie
- **E**: act in a room (talk, pick up, plant)
- **1–9**: pick a menu option · **Space**: continue · **Esc**: back / menu
- Keyboard only. Desktop browsers: Chrome, Firefox, Safari.

## AI-use disclosure (the jam asks for this)

This game was built by one developer with AI coding assistants (Claude) used for planning, scaffolding, implementation and review, directed and checked by the developer. All art is drawn in code and all sound is synthesised at runtime; no generated images or audio were used. The in-game "AI" characters are hand-written rule-based agents; no model runs during play.

## Press assets

Screenshots are taken from the live game at 960 × 528 (see `docs/press/`). To refresh them, run `npm run dev`, open `http://localhost:5173/?seed=42`, and capture:

1. **mansion.png**: day 1 after the briefing, with the HUD and first-day tips showing.
2. **round-table.png**: the first Round Table during a speech.
3. **night.png**: the night screen with the victims shown.

**cover.png** is the title screen captured at 630 × 500.

**sneak.gif** (manual, needs a screen recorder): hold Shift and walk from the Great Hall into the Library past Marcus's cone, about 4 seconds. Record with QuickTime (⌘⇧5) and convert with `ffmpeg -i sneak.mov -vf "fps=12,scale=600:-1" sneak.gif`, or with gifski. Keep it under 3 MB.

## Submission checklist (M7)

- [ ] `npm run check && npm run build` green on `main`
- [ ] Tag `v1.0.0`; the release workflow attaches `traitors-html5.zip`
- [ ] Upload the zip, set the embed to 960 × 528 with the fullscreen button
- [ ] Test the itch.io page in Chrome, Firefox and Safari, windowed and fullscreen
- [ ] Add cover, screenshots, GIF, description, controls, disclosure
- [ ] Submit to the Game Off 2026 jam page before **1 Dec 2026, 13:37 PST (21:37 UK)**
- [ ] Post in the jam community thread
