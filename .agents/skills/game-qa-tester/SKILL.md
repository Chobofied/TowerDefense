---
name: game-qa-tester
description: Run automated and on-demand browser simulation testing on desktop and mobile viewports for the Tower Defense game, capture visual screenshots, verify combat/UI mechanics, and generate structured markdown test reports.
---

# Tower Defense QA & Verification Skill

Use this skill whenever you need to run end-to-end user simulation tests on the Tower Defense game, either automatically after feature development or on-demand when requested by the user.

---

## 🚀 Quick Execution Commands

The repository contains an automated Puppeteer test suite in `tests/run-tests.js`.

### Run Full Suite (Desktop + Mobile)
```bash
npm test
# or: node tests/run-tests.js
```

### Run Desktop Only (1280×800)
```bash
npm run test:desktop
# or: node tests/run-tests.js --desktop
```

### Run Mobile Only (390×844 Touch Viewport)
```bash
npm run test:mobile
# or: node tests/run-tests.js --mobile
```

### Custom Port Option
If live-server runs on a non-default port (e.g. 8080):
```bash
node tests/run-tests.js --port=8080
```

---

## 🔍 Verification Checklist

Every test run automatically verifies the following critical user journeys:

### 1. Desktop Experience
- [x] **Header Stats**: Wave, Gold, Lives, and Remaining Enemies update dynamically.
- [x] **Tower Selection**: Key shortcuts (`[1-9]`, `[Q]`, `[W]`, `[E]`), click-to-select, and glow border.
- [x] **Hover Tooltips**: `#tower-tooltip` displays with stats, element, DPS, and tips.
- [x] **Canvas Building**: Grid click creates tower, shows range circle, and deducts gold.
- [x] **Combat Progression**: `Start Wave` spawns creeps, fires projectiles, updates active counters.
- [x] **Abilities & Modals**: `Boost [B]` cooldown, `Shop [P]` modal purchase list, and `Save [S]` toast.

### 2. Mobile Touch Experience
- [x] **Responsive Viewport**: 100dvh scaling, square canvas on top, bottom dock fixed.
- [x] **Mobile Tab Switching**: Instant switching between `🏰 Towers`, `🌊 Waves`, and `ℹ️ Intel`.
- [x] **Tower Info Sheet `(i)`**: Tapping info badge opens full modal with DPS, crit multipliers, and element stats.
- [x] **Touch Deployment**: Tap-to-select tower card + tap grid cell on canvas.
- [x] **Thumb-Dock Controls**: Pinned `▶ Start Wave`, `⚡ Boost`, `🛍️ Shop`, `💣 Bomb`.

---

## 📁 Artifact Outputs & File Organization

All visual outputs and test documents are saved in dedicated, version-controlled repository directories:

```text
TowerDefense/
├── tests/
│   ├── run-tests.js              # Central test suite runner
│   ├── screenshots/              # Captured PNG screenshots
│   │   ├── desktop_gameplay.png
│   │   ├── mobile_towers_tab.png
│   │   ├── mobile_tower_info_modal.png
│   │   ├── mobile_waves_tab.png
│   │   └── mobile_gameplay.png
│   └── reports/                  # Generated markdown reports with timestamps
│       └── report_YYYY-MM-DD_xxxx.md
```

---

## 📝 Reporting Best Practices
When reporting test results to the user:
1. Provide a concise summary table of checks passed.
2. Link directly to the generated report in `tests/reports/`.
3. Include clickable markdown links to the captured screenshots in `tests/screenshots/`.
