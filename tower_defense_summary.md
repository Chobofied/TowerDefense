# Tower Defense Game (PixiJS, Single HTML File)


https://chobofied.github.io/TowerDefense/

## Overview
A visually stunning, feature-rich tower defense game implemented in a single HTML file using PixiJS for rendering. The game is designed to allow players to create maze-like paths for enemies by placing towers, with dynamic pathfinding, multiple enemy and tower types, upgrade/sell mechanics, and a modern UI.

---

## Core Features

- **PixiJS Rendering:**
  - Uses PixiJS (v7.2.4) for all game visuals and UI.
  - Modern, animated, and visually appealing interface.

- **Dynamic Pathfinding:**
  - Enemies start at a fixed point and must reach the end point.
  - No predefined path: enemies use A* or BFS to find the shortest path around towers.
  - If blocked (no path), enemies attack and destroy towers until a path opens.
  - Flying enemies ignore towers and move directly to the end.

- **Tower Placement & Maze Building:**
  - Players can place towers anywhere on the grid (except start/end).
  - Towers act as obstacles, forcing enemies to zig-zag through player-created mazes.
  - Towers cannot be placed off-grid or on top of other towers.

- **Multiple Enemy Types:**
  - Normal, Fast, Tank, Healing, Flying, and Boss enemies.
  - Each type has unique stats (health, speed, damage, reward, etc.).
  - Flying enemies ignore obstacles.

- **Multiple Tower Types:**
  - Basic, Rapid, Cannon, Tesla, Ice, etc.
  - Each tower has unique stats (damage, range, fire rate, special effects).
  - Towers can be upgraded (up to 5 levels) and sold.
  - Some towers have special effects (splash, slow, chain lightning, etc.).

- **Waves & Bosses:**
  - Multiple waves, each with increasing difficulty and enemy count.
  - Every 5th wave is a Boss wave (single, powerful enemy).
  - Currency and score awarded for defeating enemies and completing waves.

- **Economy:**
  - Earn currency by defeating enemies and completing waves.
  - Spend currency to buy, upgrade, or sell towers.
  - Power-ups can be purchased or collected.

- **UI & UX:**
  - Modern, visually appealing UI (PixiJS-based, not DOM overlays).
  - Tower selection panel with hotkeys (Q/W/E/R/T, etc.).
  - In-game stats: health, wave, score, currency, enemies killed.
  - Clickable enemies show detailed stats/info panel.
  - Upgrade/sell tower panel appears on tower click.
  - Start/exit game buttons, next wave button, burst ability button.
  - Floating damage numbers, visual effects, and animations.

- **Hotkeys:**
  - Q/W/E/R/T: Select tower types for placement.
  - B: Activate burst ability (temporary fire rate boost).
  - N: Start next wave.
  - ESC: Exit game/fullscreen.

- **Game Flow:**
  - Select difficulty (Easy/Medium/Hard) to start.
  - Place towers, start waves, defeat enemies, earn currency.
  - Survive as many waves as possible; game ends when health reaches 0.

---

## Technical Details

- **Grid:** 16x12 tiles, with a UI panel on the right.
- **Pathfinding:** A* or BFS on a 2D grid, recalculated when towers are placed/removed.
- **Enemy AI:**
  - Non-flying: Follows path, attacks towers if blocked.
  - Flying: Ignores obstacles, moves straight to end.
- **Tower Mechanics:**
  - Each tower has health (can be destroyed by enemies if blocking all paths).
  - Upgrades increase stats (damage, range, fire rate, etc.).
  - Sell returns a percentage of total spent.
- **Waves:**
  - Configurable enemy types and counts per wave.
  - Boss every 5th wave.
- **Power-ups:**
  - Randomly spawn, provide temporary boosts (damage, fire rate, range, currency, etc.).
- **UI:**
  - All UI elements (buttons, panels, info) rendered with PixiJS.
  - Responsive to window size/fullscreen.

---

## Example Game Config (Pseudo-code)

```
GAME_CONFIG = {
  grid: { width: 16, height: 12, uiWidth: 240 },
  towers: { ... },
  enemies: { ... },
  upgrades: { ... },
  waves: { ... },
  powerUps: { ... },
  burstAbility: { ... },
  ui: { ... }
}
```

---

## How to Play

1. **Select Difficulty** (Easy/Medium/Hard).
2. **Place Towers** using mouse or hotkeys (Q/W/E/R/T).
3. **Start Waves** and defeat enemies.
4. **Earn Currency** to buy, upgrade, or sell towers.
5. **Survive** as many waves as possible.
6. **Click Enemies** to view stats.
7. **Upgrade/Sell Towers** by clicking them.
8. **Use Burst Ability** (B) for temporary boost.
9. **Exit Game** with ESC or exit button.

---

## Notable Mechanics

- **No Predefined Path:**
  - Enemies always recalculate shortest path to end after each tower placement.
  - If blocked, enemies attack towers until a path opens.
- **Flying Enemies:**
  - Ignore all obstacles, always reach the end.
- **Maze Building:**
  - Player creativity in tower placement determines enemy path.
- **Boss Waves:**
  - Every 5th wave is a boss with high health and damage.
- **Modern UI:**
  - All controls, stats, and info are visually integrated into the game canvas.

---

