# Tower Defense (PixiJS)

Play now: https://chobofied.github.io/TowerDefense/

A fast, polished, and fully client-side tower defense game rendered with PixiJS. Build mazes with towers, counter elemental enemies, trigger boosts and bombs, and push through curated and mixed waves—including air and boss waves.

## Features

- Smooth PixiJS rendering (v7.2.4), responsive canvas, mobile-friendly UI.
- Grid-based maze building; towers block ground paths and force reroutes.
- Data-driven balance via `game-config.json` (no build needed).
- Towers: Cannon, Melee, Missile (Splash) + unlockable Anti-Air, Slow, Sniper, Fire, Water, Earth.
- Elements system (fire/water/earth/physical/slow) with strengths/weaknesses.
- Enemies: Fire, Water, Earth, Normal, Flying + Boss; scalable per wave.
- Waves: curated sequence with mixed waves and special Air/Boss patterns.
- Shop: purchase advanced towers with gold; persistent purchased list.
- Abilities: global Boost (temporary speed-up) and consumable Bombs.
- Items: random drops (Gold, Damage Boost, Speed Boost).
- Floating damage numbers, splash effects, and selection tooltips.

## How to Play

1. Place towers using hotkeys shown in the UI (defaults):
   - Cannon [Q], Melee [W], Missile (Splash) [E]
   - After purchase in the Shop: Anti-Air [A], Slow [S], Sniper [T], Fire [F], Water [Y], Earth [U]
2. Start the wave and defeat enemies before they reach the end tile.
3. Earn gold from kills and wave completion; spend gold in the Shop.
4. Use Boost [B] for a temporary global speed multiplier (has cooldown).
5. Buy and place Bombs [X]: instant AoE damage at a chosen tile.
6. Survive as many waves as possible; protect your lives.

Tip: Build winding paths to maximize time in range. Mix elements to exploit enemy weaknesses, and don’t forget Anti-Air for flying waves.

## Controls & UI

- Place Towers: press a tower hotkey, then click a valid grid tile (start/end are blocked).
- Boost: [B] to activate when off cooldown.
- Bomb: [X] to enter placement mode, then click to detonate (if you have bombs).
- Next Wave / Start: use the on-screen buttons.
- Shop: open from the UI to buy advanced towers and bombs.
- Stats: hover enemies for details; tower stats/tooltip on hover.

## Configuration (data-driven)

All balance and content live in `game-config.json`:

- `gameSettings`: grid and tile size, starting gold/lives, version, drop chance.
- `towers`: base towers available at start (Cannon, Melee, Missile).
- `shopTowers`: advanced towers unlocked via Shop with `shopPrice` and hotkeys.
- `slowTower`: global slow effect parameters applied by the Slow tower.
- `enemies` and `boss`: base stats and per-wave scaling with elemental props.
- `wavePatterns`: curated patterns, mixed wave chance, and spawn duration.
- `items`: Gold and temporary buffs that can drop from enemies.
- `boost`: global temporary speed multiplier, duration, cooldown.
- `bomb`: purchasable AoE nuke with damage/radius/duration and hotkey.
- `elements`: element metadata and strengths/weaknesses.

You can tweak values and immediately test by refreshing the browser—no bundling needed.

## Project Structure

- `index.html` — game logic and PixiJS rendering in a single file.
- `game-config.json` — all content/balance knobs.
- `Game_Images/` — tower icons and art assets.

## Run Locally

Option 1 (quick): double-click `index.html` to open in your browser.

Option 2 (serve locally for consistent file loading):

```powershell
# From the project folder
# If you have Node.js
npx serve . -p 8080
# or
npx http-server -p 8080
```

Then visit http://localhost:8080/TowerDefense/index.html (or the path served by your tool).

## Tech Notes

- Rendering: PixiJS Application with autoDensity and device-pixel scaling.
- Pathfinding: grid-based; ground enemies follow paths around placed towers; flying can bypass.
- State: towers, enemies, projectiles, items, effects, and pooled damage text.
- Mobile: orientation-resilient canvas sizing and touch placement flow.

## Credits

- Rendering: PixiJS (https://pixijs.com/)
- Icons/Art: see `Game_Images/`

## License

This is a personal project. If you want to reuse parts, please open an issue or reach out.
