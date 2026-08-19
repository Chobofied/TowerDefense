# Game Testing & Verification Protocol

## Purpose
Enforce continuous automated verification and visual regression testing across both Desktop and Mobile viewports whenever making code changes, feature additions, or UI refactors to this game.

## Mandatory Workflow on Game Updates

Whenever implementing major features, UI redesigns, balance changes, or bug fixes:

1. **Local Server Check**:
   - Ensure the local dev server is active on `http://localhost:5500` (or the active live-server port).

2. **Automated Test Execution**:
   - Run the automated test suite using:
     ```bash
     npm test
     # or: node tests/run-tests.js
     ```
   - If testing a specific platform only:
     ```bash
     npm run test:desktop
     npm run test:mobile
     ```

3. **Verify All Core Scenarios**:
   - **Desktop View (1280x800)**:
     - Header stats rendering (Wave, Gold, Lives, Enemies Left).
     - Deployable tower cards with hotkeys and hover tooltips.
     - Canvas tower placement & range indicator circles.
     - Tower inspection window (Upgrade & Sell).
     - Abilities (`Boost [B]`, `Shop [P]` modal, `Bomb [X]`).
     - Combat loop progression and wave completion.
   - **Mobile View (390x844 Touch)**:
     - Canvas scaling and 100dvh / safe area positioning.
     - Mobile tab switching (`🏰 Towers`, `🌊 Waves`, `ℹ️ Intel`).
     - Tower info sheet `(i)` badge modal.
     - Touch-to-select and touch-to-place on grid.
     - Fixed thumb dock primary action buttons (`Start Wave`, `Boost`, `Shop`, `Bomb`).

4. **Visual Proof & Report Generation**:
   - Verify that updated screenshots are automatically saved into `tests/screenshots/`.
   - Ensure the markdown test report is produced in `tests/reports/`.
   - In the final response, summarize test results and provide clickable links to the generated test report and screenshots.
