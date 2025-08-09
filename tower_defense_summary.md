# Tower Defense Game (PixiJS, Single HTML File)


https://chobofied.github.io/TowerDefense/

## Overview
A visually stunning, feature-rich tower defense game implemented in a single HTML file using PixiJS for rendering. The game is designed to allow players to create maze-like paths for enemies by placing towers, with dynamic pathfinding, multiple enemy and tower types, upgrade/sell mechanics, and a modern UI.

---

## Core Features

- **PixiJS Rendering:**
  # Tower Defense – Summary for Prompts (Aug 2025)

  Use this file as authoritative reference when prompting about how the current game works. It mirrors the code and `game-config.json` shipped in this repo.

  ## High-level

  - Single-file PixiJS game (`index.html`) driven by `game-config.json`.
  - Grid-based tower defense; player places towers to shape a path from start to end.
  - Ground enemies pathfind around towers; flying enemies bypass the grid.
  - Data-driven: towers, enemies, elements, waves, items, boost, and bombs are defined in JSON.

  ## Grid & Map

  - gridSize: 14 (14x14 tiles)
  - tileSize: 48 px
  - Canvas internal size equals MAP_WIDTH x MAP_HEIGHT (gridSize * tileSize), but display is responsive.
  - Start tile: x=0, y=floor(grid/2). End tile: x=grid-1, y=floor(grid/2).
  - Player cannot place towers on start or end.

  ## Economy & Run State

  - Starting: gold=500, lives=20, wave=1.
  - Gold from enemy rewards and wave completion (+50 per wave by default).
  - Game ends at lives <= 0.
  - LocalStorage: `purchasedTowers` persists purchased shop towers across sessions.

  ## Towers

  Available at start (from `towers`):
  - Cannon [Q]
    - cost 30, range 120, fireRate 0.8, damage 5, element physical.
  - Melee [W]
    - cost 70, range 50, fireRate 0.4, damage 20, element physical, ground only, hits all nearby ground enemies.
  - Missile (Splash) [E]
    - cost 100, range 120, fireRate 1.2, damage 20, element physical
    - splashRadius 80, splashDamageRatio 0.7.

  Unlockable via Shop (`shopTowers`), pay `shopPrice` once to unlock hotkey:
  - Anti-Air [A]
    - cost 75, range 200, fireRate 1.0, damage 200, element physical, flyingOnly true.
  - Slow [S]
    - cost 100, range 110, fireRate 0.5, damage 8, element slow; applies slow effect.
  - Sniper [T]
    - cost 150, range 300, fireRate 2.0, damage 70, high crit.
  - Fire [F]
    - cost 140, range 85, fireRate 0.3, damage 12, element fire.
  - Water [Y]
    - cost 140, range 85, fireRate 0.3, damage 12, element water.
  - Earth [U]
    - cost 140, range 85, fireRate 0.3, damage 12, element earth.

  Shared tower params (per tower type):
  - damageVariation (±%), critChance, critMultiplier, color, image, tips/description.
  - Slow Tower uses global `slowTower`: slowAmount 0.4, slowDuration 2s, effectColor.

  Placement & selection:
  - Click or touch to place if you have enough gold and tile is free (not start/end).
  - Preview sprites shown during placement; tooltips display stats.

  ## Elements

  - physical (neutral)
  - fire (strongAgainst: earth, weakAgainst: water)
  - water (strongAgainst: fire, weakAgainst: earth)
  - earth (strongAgainst: water, weakAgainst: fire)
  - slow (meta element used by Slow tower effects)

  Damage calculation considers:
  - Base damage with variation and crits.
  - Elemental multipliers based on attacker.element vs enemy.element.

  ## Enemies

  From `enemies` list:
  - Fire, Water, Earth, Normal, Flying.
  - Each: baseSpeed, baseHp, reward, color, element, emoji, waveScaling {hp, speed}.
  - Flying: ignores obstacles, goes straight to end.

  Boss (separate `boss` entry):
  - BaseSpeed 1.1, baseHp 300, reward 100, element physical.
  - Has its own waveScaling.

  ## Waves

  - `wavePatterns` contains:
    - mixedWaveChance: 0.6
    - spawnDuration: 3000 ms (per enemy group batch)
    - named patterns: Fire Wave, Water Wave, Earth Wave, Normal Wave, Mixed Wave, Air Wave, Boss Wave
    - sequence: predefined order of non-boss waves indices; logic also supports mixed waves by chance.
  - UI shows current and next waves; waves can be started via UI.
  - Enemies spawn over time; HP and speed scale each wave using per-enemy waveScaling.

  ## Items (Drops)

  - Gold (25)
  - Damage Boost (+0.3 for 20s)
  - Speed Boost (+0.5 for 20s)
  - Drop chance: 0.15 per killed enemy (base).

  Collecting items applies effects immediately.

  ## Boost (Global Ability)

  - Hotkey [B], speedMultiplier 2.0, duration 5s, cooldown 25s.
  - Affects global game speed/fire rates for a short time.

  ## Bombs (Consumable Ability)

  - Shop entry: name "Explosive Bomb", shopPrice 300.
  - Combat: damage 300, radius 120, explosionDuration 0.5s, color 0xff3300.
  - Hotkey [X]: toggles placement mode; click a tile to detonate if you own bombs.
  - `bombCount` tracked and shown in UI.

  ## Pathfinding & Movement

  - Path grid recalculated on placement changes.
  - Ground enemies follow shortest path; if path blocked entirely (depending on current code path), flyingBypass allows flying to ignore, ground will not place on start/end; enemy selection/hover shows stats.

  ## UI & UX

  - Desktop and mobile layouts.
  - Live stats: wave, gold, lives, enemies left, bomb count, version tag.
  - Buttons: Start/End, Next Wave, Boost, Shop, Place Bomb (mobile also).
  - Shop modal with entries for Bombs and all Shop towers, showing affordability and counts.
  - Tooltips for towers; enemy hover shows detailed stats panel.
  - Floating damage numbers; splash damage numbers for AoE.

  ## Persistence & State

  - purchasedTowers persisted via localStorage.
  - VERSION from `game-config.json` displayed in UI.

  ## Files & Assets

  - `index.html` — all runtime logic and rendering.
  - `game-config.json` — content/balance configuration.
  - `Game_Images/` — images for towers (cannon.png, missile.png, anti_air.png, etc.).

  ## Hotkeys (default)

  - Q/W/E — base towers: Cannon, Melee, Missile (Splash)
  - A/S/T/F/Y/U — shop towers after purchase: Anti-Air, Slow, Sniper, Fire, Water, Earth
  - B — Activate Boost
  - X — Place Bomb

  ## Notes for Future Changes

  - Adding a new tower: extend `towers` (for base) or `shopTowers` (for unlockables), provide image in `Game_Images/`, and map a unique hotkey.
  - Element interactions: update `elements` and ensure enemies/towers reference correct `element` keys.
  - Wave tuning: adjust `wavePatterns.patterns`, `sequence`, and `mixedWaveChance`.
  - Balance knobs: damageVariation, crits, range, fireRate, rewards, and waveScaling.

