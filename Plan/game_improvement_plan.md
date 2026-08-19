# Tower Defense (PixiJS) — Quality & Feature Improvement Plan

This document outlines prioritized ideas, technical specifications, and a phased implementation roadmap to elevate the gameplay, audiovisual polish, tactical depth, and codebase architecture of the PixiJS Tower Defense game.

---

## 🧭 Executive Summary & Priority Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  TOP PRIORITY IMPACT MATRIX                             │
│                                                                                         │
│   [Massive Impact / Medium Effort]        │   [High Impact / Low Effort]                │
│   • 🔊 Procedural Web Audio Engine        │   • ⏩ Game Speed (1x/2x/3x) & Pause        │
│   • 🗺️ Animated Path Flow Visualizer      │   • 🎯 Tower Targeting Priorities           │
│   • 🔥 Status Effects / DoT System        │   • 🪙 100% Sell Refund Grace Period        │
│                                           │   • 📊 Tower Performance (MVP) Tracker      │
│   ────────────────────────────────────────┼──────────────────────────────────────────   │
│   [High Impact / High Effort]             │   [Medium Impact / Low Effort]              │
│   • 🗺️ Multiple Map Layouts & Obstacles   │   • ⌨️ Hotkey Cheat Sheet Overlay           │
│   • ⚔️ Branching Tower Specializations    │   • 👁️ All-Towers Range Overlay (Shift)     │
│   • 👑 Interactive Multi-Phase Bosses     │   • ⚙️ Data-Driven Balancing Migration      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Comprehensive Feature Tables

### 1. 🔊 Audio Engine & Sensory Juice (The #1 Missing Polish Element)
*Zero-dependency synthesized Web Audio API sound effects and tactical game feel polish.*

| Status | Feature | Description | Impact | Effort |
| :---: | :--- | :--- | :---: | :---: |
| [x] | **Procedural Web Audio Synthesizer** | **Zero External Assets**: Pure HTML5 Web Audio API waveform synthesis.<br>• **Weapons**: Punchy cannon thumps, laser zaps, blade swooshes, artillery booms.<br>• **Spells**: Crystalline freeze chimes (Slow), fire sizzle, water splash, earth thud.<br>• **Feedback**: Splats/pops on enemy death, boss roar/alarm, life lost alert, coin pickup chimes, wave start horns, and victory fanfares.<br>• **Controls**: Mute button & volume slider in HUD. | **Massive** | Medium |
| [x] | **Haptic Screen Shake** | Subtle canvas impulse on Bomb detonations, Boss step impacts, and Life loss. Dynamic easing back to center with zero drift. | High | Low |
| [x] | **Dynamic Creep Path Flow Line** | Animated glowing neon dots or directional chevrons along the active A* path from spawn to exit. Dynamically recalculates in real-time as towers are hovered/placed or sold, visually showing how player mazes redirect ground creeps. | High | Medium |
| [x] | **Damage Floaties & HP Bar Polish** | Trailing white "chip damage" bar on enemy health gauges for clear visual feedback. Distinct bouncy critical hit text animations (`+CRIT! 140`). | Medium | Low |

---

### 2. 🎮 Strategic Depth & Combat Mechanics

| Status | Feature | Description | Impact | Effort |
| :---: | :--- | :--- | :---: | :---: |
| [x] | **Tower Targeting Priorities** | Allow players to select targeting modes per tower:<br>• **First**: Furthest along path towards exit (default).<br>• **Last**: Closest to spawn point.<br>• **Strongest**: Highest remaining HP (vital for Sniper/Fire).<br>• **Weakest**: Lowest remaining HP (finishes off low-health creeps).<br>• **Closest**: Closest physical distance to tower.<br>• **Air Priority**: Prioritizes flying creeps when available.<br>Cycle modes via UI or `Tab` key. | **High** | Low |
| [x] | **Status Effects & Debuffs System** | Expand combat interactions beyond flat Slow:<br>• **Burn (Fire)**: Deals % max HP damage over time (DoT) for 3–5s (stacks up to 3x).<br>• **Soaked / Wet (Water)**: Enemies take +30% amplified damage from Earth/Shock and slow duration is doubled.<br>• **Sunder / Stun (Earth)**: Critical hits inflict a 0.5s micro-stun or shatter 25% physical armor.<br>• **Bleed / Cleave (Melee)**: Ground creeps hit by melee swings bleed while walking. | **High** | Medium |
| [x] | **Branching Tower Specializations** | At Level 4, choose between two distinct specializations:<br>• *Cannon* ➔ **Gatling Turret** (rapid-fire minigun) vs. **Artillery Mortar** (slow heavy shell, screen-wide range).<br>• *Fire Tower* ➔ **Inferno Beam** (ramping continuous laser) vs. **Napalm Launcher** (creates burning ground hazards).<br>• *Slow Tower* ➔ **Blizzard Aura** (continuous 360° slow pulse) vs. **Permafrost** (chance to freeze solid).<br>• *Melee Tower* ➔ **Whirlwind Blade** (360° spin cleave) vs. **Executioner** (massive damage to enemies <40% HP). | High | High |
| [x] | **100% Sell Refund Grace Period** | Full 100% gold refund if a tower is sold within 5 seconds of placement or before the wave starts. Prevents accidental misclicks from ruining runs. | High | Low |

---

### 3. ⏱️ Quality of Life, Pacing & Controls

| Status | Feature | Description | Impact | Effort |
| :---: | :--- | :--- | :---: | :---: |
| [x] | **Game Speed & Pause System** | Controls: `[Pause ⏸️]`, `[1x ▶️]`, `[2x ⏩]`, `[3x ⏭️]`.<br>Hotkeys: `Space` (Toggle Pause/Resume), `1` (1x), `2` (2x), `3` (3x). Maintains deterministic physics and smooth interpolation across speeds. | **High** | Low |
| [x] | **Auto-Start Waves Toggle** | Optional toggle in the UI to automatically trigger the next wave 2 seconds after the current wave is wiped out (ideal for high-speed farming). | Medium | Low |
| [x] | **All-Towers Range Overlay** | Hold `Shift` or click "Show Ranges" HUD button to render translucent range circles for all placed towers simultaneously, highlighting dead zones. | Medium | Low |
| [x] | **Hotkey Cheat Sheet Modal** | Accessible via `?` or `H` key. Lists all keyboard shortcuts for building, upgrading (`U`), selling (`Delete`/`Backspace`), abilities (`B`, `X`), and shop navigation. | Medium | Low |
| [x] | **Target Reticle / Line of Sight** | When clicking an active tower, draw a sleek laser targeting line to its current targeted enemy. | Medium | Low |

---

### 4. 👾 Enemy Variety & Interactive Boss Mechanics

| Status | Feature | Description | Impact | Effort |
| :---: | :--- | :--- | :---: | :---: |
| [x] | **Special Enemy Archetypes** | Add distinct tactical behaviors:<br>• **Shielded / Golem**: Absorbs 4 physical hits or has an elemental barrier that must be popped by opposing elemental damage.<br>• **Splitter**: On death, splits into 2 smaller, fast-moving "Minions" with lower HP.<br>• **Healer / Shaman**: Emits periodic healing pulses restoring 12% HP to neighboring creeps.<br>• **Speed Buffer**: Emits a haste aura increasing speed of neighboring ground creeps by 25%.<br>• **Stealth / Camouflage**: Cloaked until within range of a Melee tower or revealed by a Radar/Utility tower. | **High** | Medium |
| [x] | **Multi-Phase Interactive Bosses** | Dynamic interactive boss phases rather than simple bullet sponges:<br>• **Enrage Phase**: Moves 35% faster when HP drops below 30%.<br>• **Minion Summon**: Periodically spawns escorts at 50% HP.<br>• **Tower EMP / Disruption**: Periodically emits a shockwave temporarily disabling adjacent towers for 2.5s. | High | Medium |

---

### 5. 🗺️ Maps, Game Modes & Meta-Progression

| Status | Feature | Description | Impact | Effort |
| :---: | :--- | :--- | :---: | :---: |
| [x] | **Multiple Map Layouts & Obstacles** | Introduce selectable maps from the main menu:<br>• **Map 1: Open Plains**: Classic open 14x14 grid (sandbox mazing).<br>• **Map 2: The Chasm**: Static unbuildable rock/pit tiles forcing intricate winding mazes.<br>• **Map 3: Crossroads**: Two distinct enemy spawn portals converging toward a single defense core.<br>• **Map 4: Twin Exits**: One spawn portal with two separate exit portals to protect. | **High** | High |
| [x] | **Live Tower Efficiency (MVP) Tracker** | Clicking any tower displays: **Total Damage Dealt**, **Kills Secured**, and **Gold Efficiency (Damage per Gold Spent)**. End-game screen crowns the **MVP Tower of the Run**. | High | Low |
| [x] | **Run Summary & Local High Scores** | Detailed post-match report: Total Waves Cleared, Enemies Slain, Gold Earned, Damage by Element Breakdown, and Best Maze Length. Saves top 10 best runs in `localStorage`. | Medium | Low |
| [x] | **Persistent Meta Star / Relic Mastery** | Earn Star Tokens for defeating Boss waves to unlock permanent minor perks:<br>• *Starter Treasury*: +50 starting gold per rank.<br>• *Fortified Base*: +2 starting lives per rank.<br>• *Engineering Guild*: 6% reduced tower upgrade costs per rank.<br>• *Merchant Contract*: 10% cheaper Shop unlock prices per rank.<br>• *Overclock Reactor*: +1s Boost duration per rank. | High | Medium |

---

### 6. 🏗️ Code Architecture & Data-Driven Balance

| Status | Feature | Description | Impact | Effort |
| :---: | :--- | :--- | :---: | :---: |
| [x] | **Data-Driven Math Extraction** | Migrate remaining hardcoded constants to `game-config.json`:<br>• Boss life penalty count (`bossLifePenalty: 3`).<br>• Air wave count/speed scaling formula.<br>• Upgrade cost formula multiplier (`0.7 * level`).<br>• Sell refund percentage (`0.5 * level`).<br>• Grace refund duration (`5s`). | Medium | Low |
| [x] | **Modular Zero-Build Architecture** | Refactored monolithic `index.html` (5,500+ lines) into clean modular components while maintaining zero-build local execution:<br>• `src/config.js` — Configuration loader & schema validator.<br>• `src/audio.js` — Procedural Web Audio synthesizer.<br>• `src/pathfinding.js` — A* grid, dynamic flow lines, and blocking validation.<br>• `src/maps.js` — Multi-map layouts, obstacles, and multi-portal support.<br>• `src/meta.js` — Star Vault, persistent Relics, and Run Analytics.<br>• `src/effects.js` — Screen shake, particle systems, damage floaties & pooled text.<br>• `src/enemies.js` — Creep physics, status effects, traits, and Boss phases.<br>• `src/towers.js` — Targeting AI, branching specializations, refund grace period, and range overlays.<br>• `src/ui.js` — Glassmorphic HUD, modals, cheat sheet, and debriefing.<br>• `src/game.js` — Master game coordinator and game loop engine. | Medium | Medium |
