/**
 * Writes docs/press/cover.html: the itch.io cover (630×500) composed from the logo
 * and the cast's portraits, so the cover always matches the in-game art.
 * Screenshot it at 630×500 to produce docs/press/cover.png.
 */
import { writeFileSync } from 'node:fs';
import { shapesToSvg } from '../src/app/art/draw';
import { BUST, bust, lookOf } from '../src/app/art/looks';

const cast = ['marcus', 'priya', 'dalton', 'player', 'imogen', 'theo', 'rosa'];
const portraits = cast
  .map((id) => {
    const svg = shapesToSvg(bust(lookOf(id)), BUST.w, BUST.h);
    return `<div class="face${id === 'player' ? ' you' : ''}">${svg}</div>`;
  })
  .join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>TrAItors cover</title>
<style>
  html, body { margin: 0; width: 630px; height: 500px; overflow: hidden; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    color: #f3f1ee; font-family: system-ui, sans-serif;
    background:
      radial-gradient(ellipse at 50% 30%, rgba(179, 18, 46, 0.3), transparent 60%),
      radial-gradient(ellipse at center, #1a1a2e, #07070f);
  }
  h1 { margin: 0; font: 700 96px Georgia, 'Times New Roman', serif; letter-spacing: 3px; line-height: 1; }
  .ai { color: #ff4d6d; text-shadow: 0 0 28px rgba(255, 77, 109, 0.9), 0 0 60px rgba(255, 77, 109, 0.35); }
  p { margin: 0; color: #8f8aa3; font-size: 20px; }
  .cast { display: flex; gap: 10px; margin-top: 14px; }
  .face {
    width: 64px; height: 64px; border-radius: 50%; overflow: hidden;
    background: radial-gradient(circle at 50% 30%, #34345a, #1a1a2e);
    border: 3px solid rgba(255, 255, 255, 0.15);
  }
  .face.you { border-color: #ff4d6d; transform: scale(1.18); box-shadow: 0 0 24px rgba(255, 77, 109, 0.5); }
  .face svg { display: block; width: 100%; height: 100%; }
  .foot { font-size: 14px; color: #8f8aa3; margin-top: 10px; }
</style></head>
<body>
  <h1>Tr<span class="ai">AI</span>tors</h1>
  <p>Shift the blame. Survive the night shift.</p>
  <div class="cast">${portraits}</div>
  <div class="foot">One Traitor. Six AI Faithfuls. Hold Shift to lie.</div>
</body></html>
`;
writeFileSync('docs/press/cover.html', html);
console.log('wrote docs/press/cover.html');
