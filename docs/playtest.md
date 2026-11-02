# Playtest guide (M4)

Goal from the plan: **3 people finish a run without you explaining anything beyond the controls.** What we most want to learn: how long until their first vote, and whether they understood why they were (or weren't) voted out.

## Before

- Link: **https://chrimesdev.github.io/traitors/** (redeploys on every push to `main`).
- Desktop browser with a keyboard. It doesn't support phones yet.
- Testers who don't have a GitHub account can still copy the run report from the end screen and send it to you any way they like.

## What to say (and nothing more)

> "It's a game about being the Traitor in a house full of suspicious AI housemates, a bit like the TV show. Move with WASD, E to do things, Shift to sneak. Play one full game, then tell me what you thought. I'll stay quiet while you play, but think out loud if you can."

Don't explain lying, evidence, sight cones or the Round Table. Finding those out is what we're testing.

The sidebar shows **first-day tips** (sneak, pick up, plant, talk) on day 1 of their first game. Let them read it; don't add to it. Note whether they follow it, ignore it, or press *Hide tips*.

## While they play: what to note

Write down the time and what happened at each of these:

| Moment | Note |
| --- | --- |
| Opens the title screen | Did they read *How to play*? |
| First room change | Did they notice it cost an action? |
| First time they press E | |
| First talk to an NPC | Did they read the reply in the bottom box? Keep talking or leave? |
| First use of Shift (sneak or lie) | Which one? |
| First evidence pickup / plant | |
| First time an NPC's name turns red (glance) | Did they notice? Comment? |
| First whisper floats between two NPCs | Did they notice? |
| First Round Table | Minutes since start |
| Each banishment | Did they react? Understand? |
| End of game | Win/lose, which day |

Also note every time they **ask you a question**, **sigh or say "huh?"**, or **try something the game doesn't allow**. Those moments are the most useful.

## After: four questions

1. "What were you trying to do?"
2. "Why do you think they voted the way they did?"
3. "What did Shift do?"
4. "What would make you play again?"

Then ask them to press **Send playtest feedback** on the end screen (or **Copy run report** and send it to you). The report includes their seed and every action, so their exact game can be replayed:

```bash
npm run replay -- path/to/report.txt
```

## After all three

Add findings to `docs/open-questions.md` under the relevant question (especially #1 game length, #3 action budget, #4 caught lies), and note anything new.
