// src/game.js - Master Game Coordinator, PixiJS Stage, Input & Main Loop

import { loadConfig, CONFIG, BASE_TOWERS, ELEMENTS, SLOW_CONFIG, BOOST_CONFIG, BOMB_CONFIG, ITEM_TYPES, MAPS, RELICS, STATUS_CONFIG, SPECIALIZATIONS } from './config.js';
import { Audio } from './audio.js';
import { EffectsManager } from './effects.js';
import { PathfindingManager } from './pathfinding.js';
import { MapManager } from './maps.js';
import { MetaProgressionManager } from './meta.js';
import { EnemyManager } from './enemies.js';
import { TowerManager } from './towers.js';
import { UIManager } from './ui.js';
import { SaveManager } from './save.js';

class TowerDefenseGame {
    constructor() {
        this.app = null;
        this.worldContainer = null;
        this.graphics = null;
        this.backgroundSprite = null;
        this.gridOverlay = null;

        // Managers
        this.effects = null;
        this.pathfinding = null;
        this.mapManager = null;
        this.meta = null;
        this.enemies = null;
        this.towers = null;
        this.ui = null;
        this.saveManager = null;

        // Core Game State
        this.gold = 500;
        this.lives = 20;
        this.wave = 1;
        this.isGameRunning = false;
        this.spawningWave = false;
        this.enemySpawnQueue = [];
        this.spawnTimer = 0;
        this.bombCount = 0;
        this.placingBomb = false;
        this.selectedTowerTypeIdx = -1;
        this.selectedTower = null;
        this.selectedTowers = [];
        this.selectedEnemy = null;
        this.activeEffects = [];
        this.items = [];

        // Box Marquee Drag Selection (Desktop)
        this.isBoxSelecting = false;
        this.boxStartPos = null;
        this.boxCurrentPos = null;

        // Speed & Pacing
        this.gameSpeed = 1.0;
        this.isPaused = false;
        this.autoWave = false;

        // Zoom & Pan Camera System
        this.viewScale = 1.0;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;

        // Boost Ability
        this.boostActive = false;
        this.boostCooldown = 0;

        // Textures Cache
        this.towerTextures = {};
        this.enemyTextures = {};

        // Placement preview
        this.previewTile = null;
        this.pointerWorldPos = null;

        // References for save manager
        this.CONFIG = null;
        this.BASE_TOWERS = null;
    }

    async init() {
        await loadConfig();
        this.CONFIG = CONFIG;
        this.BASE_TOWERS = BASE_TOWERS;

        // Canvas Setup
        const container = document.getElementById('game-canvas-container');
        const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;

        this.app = new PIXI.Application({
            width: MAP_SIZE,
            height: MAP_SIZE,
            backgroundColor: 0x0a0e17,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        container.appendChild(this.app.view);

        // 1. World Container for Pan & Pinch-to-Zoom
        this.worldContainer = new PIXI.Container();
        this.app.stage.addChild(this.worldContainer);

        // 2. Create Background Texture & Beveled Grid System Overlay
        this.createBackgroundAndGrid();

        // 3. Graphics Layer (for dynamic paths, towers, combat & marquee)
        this.graphics = new PIXI.Graphics();
        this.worldContainer.addChild(this.graphics);

        // 4. Instantiate Managers
        this.effects = new EffectsManager(this.app, this.worldContainer);
        this.pathfinding = new PathfindingManager(CONFIG.gameSettings.gridSize, CONFIG.gameSettings.tileSize);
        this.mapManager = new MapManager(MAPS, CONFIG.gameSettings.tileSize);
        this.meta = new MetaProgressionManager(RELICS);
        this.enemies = new EnemyManager(CONFIG.gameSettings.tileSize, STATUS_CONFIG);
        this.towers = new TowerManager(CONFIG.gameSettings.tileSize, SPECIALIZATIONS, ELEMENTS);
        this.saveManager = new SaveManager();
        this.ui = new UIManager({
            onRelicUpgraded: () => this.applyRelicBonuses(),
            onMapChanged: () => this.restartGame(false)
        });

        // Load Textures
        this.loadTextures();
        this.towers.setTextures(this.towerTextures);
        this.enemies.setTextures(this.enemyTextures);

        // Reset towers to starter base towers (Cannon, Melee, Splash)
        CONFIG.towers = JSON.parse(JSON.stringify(BASE_TOWERS));
        try { localStorage.removeItem('purchasedTowers'); } catch { }

        // Initial Grid Setup
        this.refreshGrid();

        // Initialize Starting Resources
        this.initStartingResources();

        // Setup Controls & UI Handlers
        this.setupInputHandlers();
        this.setupUIHandlers();
        this.renderTowerSelect();
        this.renderWaveInfo();
        this.updateUI();

        // Canvas Resize
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Start Pixi Ticker
        this.app.ticker.add(delta => {
            this.gameLoop(delta);
            this.draw();
        });

        this.ui.showToast(`Gridfall v${CONFIG.gameSettings.version} Ready!`, '#38bdf8');

        // Always show the map & difficulty select modal at startup
        setTimeout(() => {
            this.ui.openMapModal(this.mapManager, this.meta, CONFIG.difficulties);
        }, 150);
    }

    createBackgroundAndGrid() {
        const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
        const GRID_SIZE = CONFIG.gameSettings.gridSize;
        const TILE_SIZE = CONFIG.gameSettings.tileSize;

        // 1. Background image sprite
        try {
            const bgTexture = PIXI.Texture.from('Game_Images/Background.png');
            this.backgroundSprite = new PIXI.Sprite(bgTexture);
            this.backgroundSprite.width = MAP_SIZE;
            this.backgroundSprite.height = MAP_SIZE;
            this.worldContainer.addChildAt(this.backgroundSprite, 0);
        } catch (e) {
            console.warn('Background image could not be loaded:', e);
        }

        // 2. Beveled Grid Overlay
        if (this.gridOverlay) {
            this.worldContainer.removeChild(this.gridOverlay);
            this.gridOverlay.destroy(true);
        }

        this.gridOverlay = new PIXI.Graphics();

        // Slight vignette
        const vignetteAlpha = 0.18;
        this.gridOverlay.beginFill(0x000000, vignetteAlpha)
            .drawRoundedRect(0, 0, MAP_SIZE, MAP_SIZE, Math.min(24, TILE_SIZE * 0.35))
            .endFill();

        // Thick dark grout lines
        const groutColor = 0x0e1118;
        const groutAlpha = 0.35;
        const highlightColor = 0xffffff;
        const highlightAlpha = 0.07;

        this.gridOverlay.lineStyle({ width: Math.max(3, Math.round(TILE_SIZE * 0.06)), color: groutColor, alpha: groutAlpha, alignment: 0.5 });
        for (let x = 0; x <= GRID_SIZE; x++) {
            const gx = x * TILE_SIZE;
            this.gridOverlay.moveTo(gx, 0).lineTo(gx, MAP_SIZE);
        }
        for (let y = 0; y <= GRID_SIZE; y++) {
            const gy = y * TILE_SIZE;
            this.gridOverlay.moveTo(0, gy).lineTo(MAP_SIZE, gy);
        }

        // Thin highlight lines offset for bevel effect
        this.gridOverlay.lineStyle({ width: 1, color: highlightColor, alpha: highlightAlpha, alignment: 0.5 });
        for (let x = 0; x <= GRID_SIZE; x++) {
            const gx = x * TILE_SIZE + 1;
            this.gridOverlay.moveTo(gx, 1).lineTo(gx, MAP_SIZE - 1);
        }
        for (let y = 0; y <= GRID_SIZE; y++) {
            const gy = y * TILE_SIZE + 1;
            this.gridOverlay.moveTo(1, gy).lineTo(MAP_SIZE - 1, gy);
        }

        // Rounded-rect inner stroke per tile
        const cornerR = Math.min(10, Math.round(TILE_SIZE * 0.15));
        this.gridOverlay.lineStyle({ width: 1, color: 0x000000, alpha: 0.15, alignment: 0.5 });
        for (let ty = 0; ty < GRID_SIZE; ty++) {
            for (let tx = 0; tx < GRID_SIZE; tx++) {
                const x = tx * TILE_SIZE + 2;
                const y = ty * TILE_SIZE + 2;
                const w = TILE_SIZE - 4;
                const h = TILE_SIZE - 4;
                this.gridOverlay.drawRoundedRect(x, y, w, h, cornerR);
            }
        }

        this.gridOverlay.cacheAsBitmap = true;

        if (this.backgroundSprite) {
            this.worldContainer.addChildAt(this.gridOverlay, 1);
        } else {
            this.worldContainer.addChildAt(this.gridOverlay, 0);
        }
    }

    loadTextures() {
        const load = (name, file) => {
            try {
                const tex = PIXI.Texture.from(`Game_Images/${file}`);
                tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
                return tex;
            } catch { return null; }
        };

        // Towers
        if (CONFIG.towers) {
            CONFIG.towers.forEach(t => { if (t.image) this.towerTextures[t.name] = load(t.name, t.image); });
        }
        if (CONFIG.shopTowers) {
            CONFIG.shopTowers.forEach(t => { if (t.image) this.towerTextures[t.name] = load(t.name, t.image); });
        }

        // Enemies
        if (CONFIG.enemies) {
            CONFIG.enemies.forEach(e => { if (e.image) this.enemyTextures[e.name] = load(e.name, e.image); });
        }
        if (CONFIG.boss && CONFIG.boss.image) {
            this.enemyTextures[CONFIG.boss.name] = load(CONFIG.boss.name, CONFIG.boss.image);
        }
    }

    getDifficultyConfig() {
        const diffId = this.meta ? this.meta.getDifficulty() : 1;
        const diffs = CONFIG ? (CONFIG.difficulties || []) : [];
        return diffs.find(d => d.id === diffId) || diffs[0] || { id: 1, name: 'Normal', hpMult: 1.0, speedMult: 1.0, rewardMult: 1.0, bossAttackInterval: 5.0, bossAttackDamage: 50 };
    }

    initStartingResources() {
        const bonusGold = this.meta ? this.meta.getStartingGoldBonus() : 0;
        const bonusLives = this.meta ? this.meta.getStartingLivesBonus() : 0;
        this.gold = (CONFIG.gameSettings.startingGold || 500) + bonusGold;
        this.lives = (CONFIG.gameSettings.startingLives || 20) + bonusLives;
        this.updateUI();
    }

    applyRelicBonuses() {
        // Safe mid-game upgrade: update UI and multiplier caches without overwriting current active gold/lives!
        this.updateUI();
    }

    refreshGrid() {
        const obstacles = this.mapManager.getObstacles();
        this.pathfinding.createGrid(obstacles, this.towers.towers);
    }

    // --- Camera Zoom & Pan System ---
    clampViewOffset() {
        const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
        if (this.viewScale <= 1.0) {
            this.viewScale = 1.0;
            this.viewOffsetX = 0;
            this.viewOffsetY = 0;
            return;
        }
        const minOffset = MAP_SIZE * (1 - this.viewScale);
        this.viewOffsetX = Math.min(0, Math.max(minOffset, this.viewOffsetX));
        this.viewOffsetY = Math.min(0, Math.max(minOffset, this.viewOffsetY));
    }

    updateWorldTransform() {
        if (this.worldContainer) {
            this.worldContainer.scale.set(this.viewScale, this.viewScale);
            this.worldContainer.position.set(this.viewOffsetX, this.viewOffsetY);
        }
    }

    // --- Input & Hotkey Handlers ---
    setupInputHandlers() {
        window.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();

            // Space: Pause / Resume
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
                return;
            }

            // 1, 2, 3: Game Speeds
            if (key === '1') { this.setSpeed(1); return; }
            if (key === '2') { this.setSpeed(2); return; }
            if (key === '3') { this.setSpeed(3); return; }

            // Shift: Range overlay
            if (e.key === 'Shift') {
                this.towers.showAllRanges = true;
                return;
            }

            // ? or H: Hotkey Cheat Sheet
            if (key === '?' || key === 'h') {
                this.ui.openCheatSheetModal();
                return;
            }

            // Tab: Cycle Selected Tower Targeting Mode
            if (e.key === 'Tab') {
                e.preventDefault();
                if (this.selectedTower) {
                    const newMode = this.towers.cycleTargetingMode(this.selectedTower);
                    this.ui.showToast(`Targeting: ${newMode.toUpperCase()}`, '#38bdf8', 1200);
                    this.showTowerStatsModal(this.selectedTower);
                }
                return;
            }

            // U: Quick Upgrade Selected Tower or Multi-Selection
            if (key === 'u') {
                if (this.selectedTowers && this.selectedTowers.length > 1) {
                    this.batchUpgradeTowers(this.selectedTowers);
                    return;
                } else if (this.selectedTower) {
                    this.upgradeTower(this.selectedTower);
                    return;
                }
            }

            // S / Delete / Backspace: Quick Sell Selected Tower or Multi-Selection
            if (key === 's' || e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedTowers && this.selectedTowers.length > 1) {
                    this.batchSellTowers(this.selectedTowers);
                    return;
                } else if (this.selectedTower) {
                    this.sellTower(this.selectedTower);
                    return;
                }
            }

            // Escape: Deselect tower or multi-selection or cancel placement
            if (e.key === 'Escape') {
                if (this.selectedTowers && this.selectedTowers.length > 0) {
                    this.selectedTowers = [];
                    this.selectedTower = null;
                    this.closeTowerStatsModal();
                    return;
                }
                if (this.selectedTower) {
                    this.selectedTower = null;
                    this.closeTowerStatsModal();
                    return;
                }
                if (this.placingBomb || this.selectedTowerTypeIdx >= 0) {
                    this.placingBomb = false;
                    this.selectedTowerTypeIdx = -1;
                    this.renderTowerSelect();
                    return;
                }
            }

            // B: Boost
            if (BOOST_CONFIG && key === BOOST_CONFIG.key.toLowerCase()) {
                this.activateBoost();
                return;
            }

            // X: Bomb
            if (BOMB_CONFIG && key === BOMB_CONFIG.key.toLowerCase()) {
                this.toggleBombPlacement();
                return;
            }

            // P: Shop
            if (key === 'p') {
                this.toggleShopModal();
                return;
            }

            // R: Quick Repair / Batch Repair
            if (key === 'r') {
                if (this.selectedTower) {
                    this.repairTower(this.selectedTower);
                } else {
                    this.repairAllTowers();
                }
                return;
            }

            // Tower Hotkeys (Q, W, E, A, S, T, F, Y, U) - only when NOT having multi-selection
            if (!this.selectedTowers || this.selectedTowers.length <= 1) {
                const tIdx = CONFIG.towers.findIndex(t => t.key.toLowerCase() === key);
                if (tIdx !== -1) {
                    this.selectedTowerTypeIdx = this.selectedTowerTypeIdx === tIdx ? -1 : tIdx;
                    this.placingBomb = false;
                    this.renderTowerSelect();
                }
            }
        });

        window.addEventListener('keyup', e => {
            if (e.key === 'Shift') {
                this.towers.showAllRanges = false;
            }
        });

        // Pointer Canvas Handlers
        const canvas = this.app.view;
        let isMouseDown = false;
        let mouseDownPos = null;
        let didDragBox = false;

        canvas.addEventListener('mousedown', e => {
            if (Date.now() < (this.ignoreCanvasClickUntil || 0)) {
                isMouseDown = false;
                return;
            }
            if (e.button === 0) { // Left click
                isMouseDown = true;
                didDragBox = false;
                mouseDownPos = this.getPointerWorldPos(e);
                this.boxStartPos = mouseDownPos;
                this.boxCurrentPos = mouseDownPos;
                this.isBoxSelecting = false;
            }
        });

        window.addEventListener('mousemove', e => {
            if (isMouseDown && mouseDownPos && !this.placingBomb) {
                const curPos = this.getPointerWorldPos(e);
                const dragDist = Math.hypot(curPos.x - mouseDownPos.x, curPos.y - mouseDownPos.y);
                if (dragDist > 10) {
                    if (this.selectedTowerTypeIdx >= 0) {
                        this.selectedTowerTypeIdx = -1;
                        this.renderTowerSelect();
                    }
                    this.isBoxSelecting = true;
                    didDragBox = true;
                    this.boxCurrentPos = curPos;
                }
            }
            this.handlePointerMove(e);
        });

        window.addEventListener('mouseup', e => {
            if (isMouseDown) {
                isMouseDown = false;
                if (this.isBoxSelecting && this.boxStartPos && this.boxCurrentPos) {
                    const minX = Math.min(this.boxStartPos.x, this.boxCurrentPos.x);
                    const maxX = Math.max(this.boxStartPos.x, this.boxCurrentPos.x);
                    const minY = Math.min(this.boxStartPos.y, this.boxCurrentPos.y);
                    const maxY = Math.max(this.boxStartPos.y, this.boxCurrentPos.y);

                    const TILE = CONFIG.gameSettings.tileSize;
                    const inside = this.towers.towers.filter(t => {
                        const cx = t.x * TILE + TILE / 2;
                        const cy = t.y * TILE + TILE / 2;
                        return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
                    });

                    this.isBoxSelecting = false;
                    this.boxStartPos = null;
                    this.boxCurrentPos = null;

                    if (inside.length === 0) {
                        this.selectedTower = null;
                        this.selectedTowers = [];
                        this.closeTowerStatsModal();
                    } else if (inside.length === 1) {
                        this.selectedTower = inside[0];
                        this.selectedTowers = [inside[0]];
                        this.showTowerStatsModal(inside[0]);
                    } else {
                        this.selectedTower = null;
                        this.selectedTowers = inside;
                        this.showMultiTowerStatsModal(inside);
                    }
                }
            }
        });

        canvas.addEventListener('mouseleave', () => {
            this.previewTile = null;
            this.pointerWorldPos = null;
        });
        canvas.addEventListener('click', e => {
            if (Date.now() < (this.ignoreCanvasClickUntil || 0)) {
                return;
            }
            if (didDragBox) {
                didDragBox = false;
                return;
            }
            this.handlePointerClick(e);
        });

        // Desktop Mouse Wheel Zoom
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
            const screenX = (e.clientX - rect.left) * (MAP_SIZE / rect.width);
            const screenY = (e.clientY - rect.top) * (MAP_SIZE / rect.height);

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
            const prevScale = this.viewScale;
            const newScale = Math.min(2.8, Math.max(1.0, this.viewScale * zoomFactor));

            if (newScale !== prevScale) {
                this.viewScale = newScale;
                this.viewOffsetX = screenX - (screenX - this.viewOffsetX) * (newScale / prevScale);
                this.viewOffsetY = screenY - (screenY - this.viewOffsetY) * (newScale / prevScale);
                this.clampViewOffset();
                this.updateWorldTransform();
            }
        }, { passive: false });

        // Touch Gestures: Pinch-to-Zoom & Pan
        let initialPinchDist = 0;
        let startPinchScale = 1.0;
        let lastTouchCenter = null;
        let touchStartPos = null;
        let isTouchDragging = false;
        let lastTapTime = 0;

        canvas.addEventListener('touchstart', e => {
            Audio.resume();
            if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                startPinchScale = this.viewScale;
                lastTouchCenter = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };
            } else if (e.touches.length === 1) {
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                isTouchDragging = false;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', e => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                if (initialPinchDist > 0) {
                    const factor = dist / initialPinchDist;
                    const newScale = Math.min(2.8, Math.max(1.0, startPinchScale * factor));

                    const center = {
                        x: (t1.clientX + t2.clientX) / 2,
                        y: (t1.clientY + t2.clientY) / 2
                    };
                    const rect = canvas.getBoundingClientRect();
                    const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
                    const screenCenterX = (center.x - rect.left) * (MAP_SIZE / rect.width);
                    const screenCenterY = (center.y - rect.top) * (MAP_SIZE / rect.height);

                    const prevScale = this.viewScale;
                    this.viewScale = newScale;
                    this.viewOffsetX = screenCenterX - (screenCenterX - this.viewOffsetX) * (newScale / prevScale);
                    this.viewOffsetY = screenCenterY - (screenCenterY - this.viewOffsetY) * (newScale / prevScale);

                    if (lastTouchCenter) {
                        const dx = (center.x - lastTouchCenter.x) * (MAP_SIZE / rect.width);
                        const dy = (center.y - lastTouchCenter.y) * (MAP_SIZE / rect.height);
                        this.viewOffsetX += dx;
                        this.viewOffsetY += dy;
                    }
                    lastTouchCenter = center;
                    this.clampViewOffset();
                    this.updateWorldTransform();
                }
            } else if (e.touches.length === 1) {
                const cur = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                if (touchStartPos) {
                    const moveDist = Math.hypot(cur.x - touchStartPos.x, cur.y - touchStartPos.y);
                    if (moveDist > 8) {
                        isTouchDragging = true;
                    }
                    if (isTouchDragging && this.viewScale > 1.0) {
                        e.preventDefault();
                        const rect = canvas.getBoundingClientRect();
                        const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
                        const dx = (cur.x - touchStartPos.x) * (MAP_SIZE / rect.width);
                        const dy = (cur.y - touchStartPos.y) * (MAP_SIZE / rect.height);
                        this.viewOffsetX += dx;
                        this.viewOffsetY += dy;
                        touchStartPos = cur;
                        this.clampViewOffset();
                        this.updateWorldTransform();
                    }
                }
                if (!isTouchDragging) {
                    this.handlePointerMove(e);
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', e => {
            if (e.touches.length === 0) {
                const now = Date.now();
                if (now - lastTapTime < 280 && !isTouchDragging) {
                    // Double tap: toggle zoom
                    if (this.viewScale > 1.1) {
                        this.viewScale = 1.0;
                        this.viewOffsetX = 0;
                        this.viewOffsetY = 0;
                    } else {
                        const pos = this.getPointerWorldPos(e);
                        this.viewScale = 1.8;
                        const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
                        this.viewOffsetX = MAP_SIZE / 2 - pos.x * 1.8;
                        this.viewOffsetY = MAP_SIZE / 2 - pos.y * 1.8;
                    }
                    this.clampViewOffset();
                    this.updateWorldTransform();
                } else if (!isTouchDragging && touchStartPos) {
                    this.handlePointerClick(e);
                }

                lastTapTime = now;
                touchStartPos = null;
                isTouchDragging = false;
                initialPinchDist = 0;
                lastTouchCenter = null;
            }
        }, { passive: false });

        // Close tower modal when clicking backdrop
        const towerModal = document.getElementById('tower-info-modal');
        if (towerModal) {
            towerModal.addEventListener('click', e => {
                if (e.target === towerModal) {
                    this.closeTowerStatsModal();
                }
            });
        }
    }

    getPointerWorldPos(e) {
        const rect = this.app.view.getBoundingClientRect();
        const MAP_SIZE = CONFIG.gameSettings.gridSize * CONFIG.gameSettings.tileSize;
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }

        const screenX = (clientX - rect.left) * (MAP_SIZE / rect.width);
        const screenY = (clientY - rect.top) * (MAP_SIZE / rect.height);

        const worldX = (screenX - this.viewOffsetX) / this.viewScale;
        const worldY = (screenY - this.viewOffsetY) / this.viewScale;

        return { x: worldX, y: worldY };
    }

    handlePointerMove(e) {
        const pos = this.getPointerWorldPos(e);
        this.pointerWorldPos = pos;
        const tx = Math.floor(pos.x / CONFIG.gameSettings.tileSize);
        const ty = Math.floor(pos.y / CONFIG.gameSettings.tileSize);

        if (tx >= 0 && tx < CONFIG.gameSettings.gridSize && ty >= 0 && ty < CONFIG.gameSettings.gridSize) {
            this.previewTile = { x: tx, y: ty };
        } else {
            this.previewTile = null;
        }
    }

    handlePointerClick(e) {
        if (Date.now() < (this.ignoreCanvasClickUntil || 0)) {
            return;
        }
        Audio.resume();
        const pos = this.getPointerWorldPos(e);
        const tx = Math.floor(pos.x / CONFIG.gameSettings.tileSize);
        const ty = Math.floor(pos.y / CONFIG.gameSettings.tileSize);

        // 1. Click Item Drop (High priority & generous 32px hitbox)
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            if (Math.hypot(it.x - pos.x, it.y - pos.y) <= 32) {
                this.collectItem(it);
                this.items.splice(i, 1);
                return;
            }
        }

        // 2. Placing Bomb
        if (this.placingBomb) {
            this.detonateBomb(pos.x, pos.y);
            return;
        }

        // 3. Click Enemy
        const clickedEnemy = this.enemies.enemies.find(en => en.alive && Math.hypot(en.x - pos.x, en.y - pos.y) <= (en.isBoss ? 28 : 18));
        if (clickedEnemy) {
            this.selectedEnemy = clickedEnemy;
            this.selectedTower = null;
            this.selectedTowers = [];
            this.showEnemyStats(clickedEnemy);
            return;
        }

        // 4. Click Placed Tower
        const clickedTower = this.towers.towers.find(t => t.x === tx && t.y === ty);
        if (clickedTower) {
            this.selectedTower = clickedTower;
            this.selectedTowers = [clickedTower];
            this.selectedEnemy = null;
            this.selectedTowerTypeIdx = -1;
            this.renderTowerSelect();
            this.showTowerStatsModal(clickedTower);
            return;
        }

        // 5. Place Tower
        if (this.selectedTowerTypeIdx >= 0) {
            this.placeTowerAt(tx, ty);
        } else {
            this.selectedTower = null;
            this.selectedTowers = [];
            this.selectedEnemy = null;
            this.hideStatsPanel();
        }
    }

    placeTowerAt(tx, ty) {
        const towerType = CONFIG.towers[this.selectedTowerTypeIdx];
        if (!towerType) return;

        if (this.gold < towerType.cost) {
            this.ui.showToast('Not enough gold!', '#f87171');
            Audio.playLifeLost();
            return;
        }

        const starts = this.mapManager.getStarts();
        const ends = this.mapManager.getEnds();
        const obstacles = this.mapManager.getObstacles();

        const canPlace = this.pathfinding.canPlaceTower(tx, ty, starts, ends, this.enemies.enemies, obstacles, this.towers.towers);

        if (!canPlace) {
            this.ui.showToast('Cannot place: blocks enemy path or obstacle!', '#f87171');
            Audio.playLifeLost();
            return;
        }

        // Finalize Placement
        this.gold -= towerType.cost;
        const tower = this.towers.createTower(towerType, tx, ty, this.wave, this.isGameRunning);
        this.refreshGrid();

        // Recalculate paths for ground enemies
        this.enemies.enemies.forEach(e => {
            if (!e.flying && e.alive) {
                const egx = Math.round((e.x - CONFIG.gameSettings.tileSize / 2) / CONFIG.gameSettings.tileSize);
                const egy = Math.round((e.y - CONFIG.gameSettings.tileSize / 2) / CONFIG.gameSettings.tileSize);
                e.path = this.pathfinding.findPath({ x: egx, y: egy }, e.endPos);
                e.pathIdx = 0;
            }
        });

        Audio.playUpgrade();
        this.selectedTowerTypeIdx = -1;
        this.renderTowerSelect();
        this.updateUI();
    }

    upgradeTower(tower) {
        const discount = this.meta.getUpgradeDiscount();
        const cost = this.towers.getUpgradeCost(tower, CONFIG.gameSettings.upgradeCostMultiplier || 0.7, discount);

        if (this.gold < cost) {
            this.closeTowerStatsModal();
            this.selectedTower = null;
            this.selectedTowers = [];
            Audio.playLifeLost();
            this.ui.showToast('Not enough gold for upgrade!', '#f87171');
            return;
        }

        this.gold -= cost;
        this.towers.upgradeTower(tower);
        Audio.playUpgrade();
        this.updateUI();
        this.showTowerStatsModal(tower);
    }

    sellTower(tower) {
        const refund = this.towers.getSellValue(
            tower,
            CONFIG.gameSettings.sellRefundRatio || 0.5,
            CONFIG.gameSettings.sellGracePeriodSeconds || 5,
            this.wave,
            this.isGameRunning
        );

        this.gold += refund;
        this.towers.removeTower(tower);
        this.refreshGrid();
        this.selectedTower = null;
        this.selectedTowers = [];
        Audio.playCoin();
        this.ui.showToast(`+${refund}g refunded`, '#facc15');
        this.updateUI();
        this.closeTowerStatsModal();
    }

    repairTower(tower) {
        if (!tower) return;
        this.closeTowerStatsModal();
        if (tower.hp >= tower.maxHp) return;

        const res = this.towers.repairTower(tower, this.gold);
        if (res.success) {
            this.gold -= res.cost;
            Audio.playBuy();
            const cx = tower.x * CONFIG.gameSettings.tileSize + 24;
            const cy = tower.y * CONFIG.gameSettings.tileSize + 24;
            this.effects.addDamageNumber(cx, cy - 16, '+HP REPAIRED! 🔧', false, 'weakness');
            this.ui.showToast(`Tower Repaired for 🪙${res.cost}g!`, '#10b981');
            this.updateUI();
        } else {
            this.ui.showToast(`Not enough gold to repair! (Needs 🪙${res.cost}g)`, '#f43f5e');
            Audio.playError();
        }
    }

    repairAllTowers(towersList = null) {
        const targetList = (towersList && towersList.length > 0) ? towersList : this.towers.towers;
        const damagedTowers = targetList.filter(t => t.hp < t.maxHp);
        this.closeTowerStatsModal();

        if (damagedTowers.length === 0) {
            this.ui.showToast('All defense towers are at 100% HP! 🛡️', '#38bdf8');
            return;
        }

        let totalRepaired = 0;
        let totalGoldSpent = 0;

        // Sort by lowest health percentage first
        damagedTowers.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));

        for (const t of damagedTowers) {
            const cost = this.towers.getRepairCost(t);
            if (this.gold >= cost) {
                const res = this.towers.repairTower(t, this.gold);
                if (res.success) {
                    this.gold -= res.cost;
                    totalGoldSpent += res.cost;
                    totalRepaired++;
                }
            }
        }

        if (totalRepaired > 0) {
            Audio.playBuy();
            this.ui.showToast(`Repaired ${totalRepaired} towers for 🪙${totalGoldSpent}g! 🔧`, '#10b981');
            this.updateUI();
        } else {
            this.ui.showToast('Not enough gold to repair any towers!', '#f43f5e');
            Audio.playError();
        }
    }

    // --- Batch Multi-Tower Operations ---
    batchUpgradeTowers(towersList) {
        if (!towersList || towersList.length === 0) return;
        const discount = this.meta.getUpgradeDiscount();
        const mult = CONFIG.gameSettings.upgradeCostMultiplier || 0.7;

        // Sort ascending by level so lowest level towers upgrade first
        const sorted = [...towersList].sort((a, b) => a.level - b.level);
        let upgradedCount = 0;
        let totalCost = 0;

        for (const t of sorted) {
            const cost = this.towers.getUpgradeCost(t, mult, discount);
            if (this.gold >= cost) {
                this.gold -= cost;
                this.towers.upgradeTower(t);
                totalCost += cost;
                upgradedCount++;
            }
        }

        if (upgradedCount > 0) {
            Audio.playUpgrade();
            this.ui.showToast(`Upgraded ${upgradedCount} towers for -${totalCost}g!`, '#10b981');
            this.updateUI();
            this.showMultiTowerStatsModal(this.selectedTowers);
        } else {
            this.closeTowerStatsModal();
            this.selectedTower = null;
            this.selectedTowers = [];
            Audio.playLifeLost();
            this.ui.showToast('Not enough gold to upgrade selected towers!', '#f87171');
        }
    }

    batchSellTowers(towersList) {
        if (!towersList || towersList.length === 0) return;
        let totalRefund = 0;
        const count = towersList.length;

        for (const t of [...towersList]) {
            const refund = this.towers.getSellValue(
                t,
                CONFIG.gameSettings.sellRefundRatio || 0.5,
                CONFIG.gameSettings.sellGracePeriodSeconds || 5,
                this.wave,
                this.isGameRunning
            );
            totalRefund += refund;
            this.towers.removeTower(t);
        }

        this.gold += totalRefund;
        this.refreshGrid();
        this.selectedTowers = [];
        this.selectedTower = null;
        Audio.playCoin();
        this.ui.showToast(`Sold ${count} towers (+${totalRefund}g refunded)!`, '#facc15');
        this.updateUI();
        this.closeTowerStatsModal();
    }

    batchSetTargeting(towersList, mode) {
        if (!towersList || towersList.length === 0) return;
        towersList.forEach(t => { t.targetingMode = mode; });
        this.ui.showToast(`Targeting set to ${mode.toUpperCase()} for ${towersList.length} towers!`, '#38bdf8', 1200);
        this.showMultiTowerStatsModal(towersList);
    }

    detonateBomb(x, y) {
        if (this.bombCount <= 0) return;
        this.bombCount--;
        this.placingBomb = false;

        this.effects.explosions.push({
            x, y,
            radius: 0,
            maxRadius: BOMB_CONFIG.radius || 120,
            color: BOMB_CONFIG.color || 0xff3300,
            alpha: 1,
            duration: 25
        });
        this.effects.triggerShake(10, 20);
        Audio.playExplosion();

        let hitCount = 0;
        let totalDmg = 0;

        for (const e of this.enemies.enemies) {
            if (!e.alive) continue;
            const dist = Math.hypot(e.x - x, e.y - y);
            if (dist <= BOMB_CONFIG.radius) {
                const ratio = 1 - (dist / BOMB_CONFIG.radius);
                const dmg = Math.round((BOMB_CONFIG.damage || 300) * ratio);
                e.hp -= dmg;
                e.hitFlash = 8;
                totalDmg += dmg;
                hitCount++;
                this.effects.addDamageNumber(e.x, e.y - 20, dmg, true);
                this.meta.recordDamage(dmg, 'physical');

                if (e.hp <= 0) {
                    e.alive = false;
                    this.gold += e.type.reward;
                    this.meta.recordKill(e.type.reward);
                    this.effects.triggerDeathEffect(e);
                }
            }
        }

        this.ui.showToast(`Bomb hit ${hitCount} enemies for ${totalDmg} dmg!`, '#ff5500');
        this.updateUI();
    }

    // --- Waves & Spawning ---
    startWave() {
        if (this.isGameRunning) return;
        this.isGameRunning = true;
        this.spawningWave = true;
        this.isPaused = false; // Always unpause cleanly when starting wave
        this.boostUsedThisWave = false;
        this.boostActive = false;
        Audio.playWaveStart();

        const count = 8 + this.wave * 2;
        const wavePattern = this.getWavePattern(this.wave);
        const diffConfig = this.getDifficultyConfig();
        const diffHpMult = diffConfig.hpMult || 1.0;
        const diffSpeedMult = diffConfig.speedMult || 1.0;
        const diffRewardMult = diffConfig.rewardMult || 1.0;

        const starts = this.mapManager.getStarts();
        const ends = this.mapManager.getEnds();

        let availableEnemies = [];

        if (wavePattern.name === 'Boss Wave') {
            let bossHpScale;
            if (this.wave <= 10) {
                // Fair and beatable in early introductory waves
                bossHpScale = 1 + (this.wave - 1) * 0.25;
            } else {
                // Progressive exponential scaling for mid, late, and endless waves
                const waveProgress = (this.wave - 10) / 10;
                const expScale = Math.pow(waveProgress, 2.2) * 2.8;
                bossHpScale = 1 + (this.wave - 1) * 0.35 + expScale;
            }
            const bossSpeedScale = 1 + (this.wave - 1) * 0.012 + Math.min(0.85, (this.wave / 100) * 0.55);
            const bossShields = this.wave >= 30 ? Math.min(8, Math.floor((this.wave - 20) / 12)) : 0;

            availableEnemies.push({
                ...CONFIG.boss,
                hp: Math.round(CONFIG.boss.baseHp * bossHpScale * diffHpMult),
                speed: CONFIG.boss.baseSpeed * bossSpeedScale * diffSpeedMult,
                shieldHits: bossShields,
                reward: Math.round((CONFIG.boss.reward || 100) * diffRewardMult)
            });
        } else {
            CONFIG.enemies.forEach(enemy => {
                if (wavePattern.enemies.includes(enemy.name)) {
                    // Progressive exponential scaling for late-game enemies
                    const lateGameFactor = Math.pow(Math.max(0, this.wave - 10) / 15, 1.75) * 1.15;
                    const hpScale = 1 + (this.wave - 1) * (enemy.waveScaling.hp || 0.22) + lateGameFactor;
                    const speedScale = 1 + (this.wave - 1) * 0.008 + Math.min(0.70, (this.wave / 100) * 0.45);
                    availableEnemies.push({
                        ...enemy,
                        hp: Math.round(enemy.baseHp * hpScale * diffHpMult),
                        speed: enemy.baseSpeed * speedScale * diffSpeedMult,
                        reward: Math.round((enemy.reward || 12) * diffRewardMult)
                    });
                }
            });
        }

        const totalEnemies = wavePattern.name === 'Boss Wave' ? 1 : count;
        const spawnIntervalSec = Math.max(0.2, ((CONFIG.wavePatterns.spawnDuration || 3000) / totalEnemies) / 1000);
        this.enemySpawnQueue = [];
        this.spawnTimer = 0; // ready immediately for 1st enemy

        for (let i = 0; i < totalEnemies; i++) {
            const type = availableEnemies[Math.floor(Math.random() * availableEnemies.length)] || CONFIG.enemies[0];
            const startNode = starts[i % starts.length];
            const endNode = ends[i % ends.length];

            this.enemySpawnQueue.push({
                type,
                startNode,
                endNode,
                interval: spawnIntervalSec
            });
        }

        this.ui.showToast(`Wave ${this.wave}: ${wavePattern.name}!`, '#38bdf8');
        this.updateUI();
    }

    getWavePattern(waveNum) {
        if (waveNum % 10 === 5) return CONFIG.wavePatterns.patterns.find(p => p.name === 'Boss Wave');
        if (waveNum % 10 === 0) return CONFIG.wavePatterns.patterns.find(p => p.name === 'Air Wave');
        // In Endless mode, frequent boss encounters
        if (waveNum > 100 && waveNum % 5 === 0) return CONFIG.wavePatterns.patterns.find(p => p.name === 'Boss Wave');
        const nonBoss = CONFIG.wavePatterns.patterns.filter(p => p.name !== 'Boss Wave' && p.name !== 'Air Wave');
        return nonBoss[waveNum % nonBoss.length] || nonBoss[0];
    }

    spawnEnemyFromQueue(item) {
        const path = item.type.flying ? null : this.pathfinding.findPath(item.startNode, item.endNode);
        const enemy = this.enemies.createEnemy(item.type, item.startNode, item.endNode, path, this.wave);
        this.enemies.enemies.push(enemy);
    }

    onEnemyReachExit(enemy) {
        const isBoss = enemy.isBoss;
        const loss = isBoss ? (CONFIG.gameSettings.bossLifePenalty || 3) : 1;
        this.lives -= loss;
        this.effects.triggerShake(isBoss ? 12 : 5, 15);
        Audio.playLifeLost();

        if (this.lives <= 0) {
            this.handleGameOver();
        } else {
            this.ui.showToast(isBoss ? `Boss Escaped! -${loss} Lives!` : 'Life Lost!', '#f43f5e');
        }
        this.updateUI();
    }

    onEnemyKilled(enemy) {
        this.gold += enemy.type.reward;
        this.tryDropItem(enemy.x, enemy.y);

        // Trait: Splitter
        if (enemy.trait === 'splitter') {
            for (let k = 0; k < (enemy.type.splitCount || 2); k++) {
                const minionConfig = {
                    name: 'Normal',
                    hp: Math.round(enemy.maxHp * 0.35),
                    baseHp: Math.round(enemy.maxHp * 0.35),
                    speed: enemy.baseSpeed * 1.3,
                    baseSpeed: enemy.baseSpeed * 1.3,
                    reward: 4,
                    color: 0xb85cf6,
                    element: 'physical',
                    image: 'Normal_Enemy.png'
                };
                const egx = Math.max(0, Math.min(13, Math.round((enemy.x - 24) / 48)));
                const egy = Math.max(0, Math.min(13, Math.round((enemy.y - 24) / 48)));
                const path = this.pathfinding.findPath({ x: egx, y: egy }, enemy.endPos);
                const minion = this.enemies.createEnemy(minionConfig, { x: egx, y: egy }, enemy.endPos, path, this.wave);
                minion.x = enemy.x + (k * 10 - 5);
                minion.y = enemy.y;
                this.enemies.enemies.push(minion);
            }
        }

        // If Boss Defeated: Award Star Token!
        if (enemy.isBoss) {
            this.meta.addStar(1);
            this.ui.showToast('👑 BOSS SLAIN! +1 Star Token ⭐', '#facc15', 3000);
            Audio.playWaveClear();
        }

        this.updateUI();
    }

    tryDropItem(x, y) {
        if (Math.random() < (CONFIG.gameSettings.itemDropChance || 0.15)) {
            // Rebalanced: ~1/3 of previous gold yields across all waves
            const goldAmount = Math.max(6, Math.round(10 + this.wave * 0.45));
            this.items.push({
                x, y,
                type: { name: 'Gold', value: goldAmount, color: '0xfacc15' },
                lifetime: 8.0, // 8 real-time seconds
                maxLifetime: 8.0,
                spawnTime: Date.now()
            });
        }
    }

    collectItem(item) {
        Audio.playCoin();
        const goldVal = item.type.value || 12;
        this.gold += goldVal;
        this.effects.addDamageNumber(item.x, item.y - 12, `+${goldVal}g Gold!`, true);
        this.ui.showToast(`+${goldVal}g Gold Collected! 🪙`, '#ffd700');
        this.updateUI();
    }

    // --- Abilities & Boost ---
    activateBoost() {
        if (this.boostActive) return;
        if (this.boostUsedThisWave) {
            Audio.playLifeLost();
            this.ui.showToast('⚡ Boost already used this round! Resets next wave.', '#f87171', 2000);
            return;
        }

        this.boostActive = true;
        this.boostUsedThisWave = true;
        const durationSec = (BOOST_CONFIG && BOOST_CONFIG.duration) || 2.5;

        Audio.playShoot('Anti-Air');
        this.ui.showToast(`⚡ BOOST ACTIVATED (${durationSec}s)!`, '#38bdf8');
        this.updateUI();

        setTimeout(() => {
            this.boostActive = false;
            this.updateUI();
        }, durationSec * 1000);
    }

    toggleBombPlacement() {
        if (this.bombCount <= 0 && !this.placingBomb) {
            this.ui.showToast('No bombs! Purchase from the Shop (P)', '#f87171');
            return;
        }
        this.placingBomb = !this.placingBomb;
        this.selectedTowerTypeIdx = -1;
        this.renderTowerSelect();
        this.updateUI();
    }

    setSpeed(spd) {
        this.gameSpeed = spd;
        this.isPaused = false;
        this.updateUI();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.ui.showToast(this.isPaused ? 'Game Paused ⏸️' : 'Game Resumed ▶️', '#38bdf8', 1000);
        this.updateUI();
    }

    // --- Save & Load ---
    saveCurrentGame() {
        const snap = this.saveManager.saveGame(this);
        if (snap) {
            Audio.playUpgrade();
            this.ui.showToast(`💾 Game Saved (Wave ${this.wave})!`, '#10b981');
        } else {
            this.ui.showToast('Failed to save game.', '#f43f5e');
        }
    }

    // --- Main Game Loop ---
    gameLoop(delta) {
        const effectiveDelta = this.isPaused ? 0 : delta * this.gameSpeed;

        // Process Spawning Queue (Deterministic delta timer, pause-safe & speed-scaled)
        if (this.spawningWave && this.enemySpawnQueue.length > 0) {
            this.spawnTimer -= (effectiveDelta / 60);
            while (this.spawnTimer <= 0 && this.enemySpawnQueue.length > 0) {
                const item = this.enemySpawnQueue.shift();
                this.spawnEnemyFromQueue(item);
                this.spawnTimer += item.interval;
            }
            if (this.enemySpawnQueue.length === 0) {
                this.spawningWave = false;
            }
        }

        // Check Wave Clear
        if (this.isGameRunning && !this.spawningWave && this.enemies.enemies.length === 0) {
            this.isGameRunning = false;
            this.boostUsedThisWave = false;
            this.boostActive = false;
            const diff = this.getDifficultyConfig();
            const reward = Math.round((CONFIG.gameSettings.waveCompleteGold || 50) * (diff.rewardMult || 1.0));
            this.gold += reward;
            this.meta.recordWaveComplete(this.wave, reward);

            const wavePattern = this.getWavePattern(this.wave);
            const isBossWave = (wavePattern && wavePattern.name === 'Boss Wave');
            const starsEarned = isBossWave ? 3 : 1;
            this.meta.addStar(starsEarned);

            Audio.playWaveClear();
            if (isBossWave) {
                this.ui.showToast(`👑 Boss Wave ${this.wave} Defeated! +${reward}g & +3 ⭐ Stars!`, '#facc15', 3000);
            } else {
                this.ui.showToast(`Wave ${this.wave} Cleared! +${reward}g & +1 ⭐ Star!`, '#10b981');
            }

            // 100-Wave Campaign Victory & Endless Choice Check
            if (this.wave === 100 && !this.endlessMode) {
                this.meta.recordDifficultyBeaten(this.difficulty);
                const nextDiffUnlocked = this.meta.unlockDifficulty(this.difficulty + 1);
                this.ui.openVictoryModal({
                    difficulty: this.difficulty,
                    difficultyName: diff.name,
                    nextDiffUnlocked,
                    onContinueEndless: () => {
                        this.endlessMode = true;
                        this.wave++;
                        this.renderWaveInfo();
                        this.updateUI();
                        this.ui.showToast('♾️ ENDLESS MODE ENGAGED! Infinite Waves Ahead!', '#facc15', 3500);
                    },
                    onFinishMission: () => {
                        this.handleGameOver();
                    }
                });
                return;
            }

            this.wave++;
            this.renderWaveInfo();
            this.updateUI();

            // Auto-Wave Trigger
            if (this.autoWave) {
                setTimeout(() => {
                    if (!this.isGameRunning && this.autoWave) this.startWave();
                }, 1800);
            }
        }

        // Update Active Item Buffs
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const eff = this.activeEffects[i];
            eff.duration -= effectiveDelta;
            if (eff.duration <= 0) this.activeEffects.splice(i, 1);
        }

        // Update Dropped Collectible Items (Decays in real-world seconds so items don't vanish in 1s on 3x speed!)
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.lifetime -= (delta / 60);
            if (it.lifetime <= 0) {
                this.items.splice(i, 1);
            }
        }

        // Update Pathfinding Flow Line Animation
        this.pathfinding.updateFlow(effectiveDelta);

        // Update Effects Manager
        this.effects.update(effectiveDelta);

        // Update Enemies & Boss Combat Attacks
        this.enemies.update(
            effectiveDelta,
            this.pathfinding,
            this.effects,
            Audio,
            this.meta,
            e => this.onEnemyReachExit(e),
            e => this.onEnemyKilled(e),
            (x, y) => {
                // Spawn Boss Minions (Properly scaled to current wave)
                const hpScale = 1 + (this.wave - 1) * 0.2;
                const speedScale = 1 + (this.wave - 1) * 0.025;
                const baseEnemy = CONFIG.enemies.find(e => e.name === 'Normal') || CONFIG.enemies[0];
                const minionConfig = {
                    ...baseEnemy,
                    hp: Math.round((baseEnemy.baseHp || 45) * hpScale * 0.4),
                    maxHp: Math.round((baseEnemy.baseHp || 45) * hpScale * 0.4),
                    speed: (baseEnemy.baseSpeed || 1.0) * speedScale * 1.15,
                    baseSpeed: (baseEnemy.baseSpeed || 1.0) * speedScale * 1.15,
                    reward: 4
                };

                const egx = Math.max(0, Math.min(13, Math.round((x - 24) / 48)));
                const egy = Math.max(0, Math.min(13, Math.round((y - 24) / 48)));
                const ends = this.mapManager.getEnds();
                const endPos = ends[0] || { x: 13, y: 7 };
                const path = this.pathfinding.findPath({ x: egx, y: egy }, endPos);

                for (let k = 0; k < 3; k++) {
                    const m = this.enemies.createEnemy(minionConfig, { x: egx, y: egy }, endPos, path, this.wave);
                    m.x = x + (k * 14 - 14);
                    m.y = y;
                    this.enemies.enemies.push(m);
                }
            },
            (x, y, radius, dur) => {
                // Boss EMP Disruption
                this.towers.towers.forEach(t => {
                    const cx = t.x * CONFIG.gameSettings.tileSize + 24;
                    const cy = t.y * CONFIG.gameSettings.tileSize + 24;
                    if (Math.hypot(cx - x, cy - y) <= radius) {
                        t.disruptedTimer = dur;
                    }
                });
            },
            this.towers,
            this.getDifficultyConfig(),
            (attackedTower, dmg) => {
                if (attackedTower.isDestroyed) {
                    this.ui.showToast(`⚠️ Tower Destroyed by Boss! Press [R] to Repair!`, '#f43f5e', 3000);
                }
            }
        );

        // Update Towers
        this.towers.update(
            effectiveDelta,
            this.enemies.enemies,
            this.effects,
            Audio,
            this.meta,
            this.boostActive,
            this.activeEffects
        );

        // Draw Frame
        this.draw();
    }

    draw() {
        this.graphics.clear();

        const pulseTime = Date.now();

        // 1. Map Obstacles & Portals
        this.mapManager.drawObstacles(this.graphics);
        this.mapManager.drawPortals(this.graphics, pulseTime);

        // 2. Dynamic Animated Path Flow Line
        const starts = this.mapManager.getStarts();
        const ends = this.mapManager.getEnds();
        this.pathfinding.drawPathFlow(this.graphics, starts, ends);

        // 3. Effects & Combat Visuals
        this.effects.draw(this.graphics);

        // 3b. Dropped Gold Coins (floating animated gold coins with glowing halo)
        const itemNow = Date.now();
        for (const it of this.items) {
            const bob = Math.sin(itemNow * 0.006 + it.x) * 4;
            const iy = it.y + bob;

            // Flashing when low on lifetime (< 2.0s remaining)
            let alpha = 1.0;
            if (it.lifetime < 2.0) {
                alpha = Math.sin(itemNow * 0.02) > 0 ? 0.95 : 0.25;
            }

            // Outer glowing gold halo
            this.graphics.lineStyle(2, 0xfacc15, alpha * 0.85).drawCircle(it.x, iy, 13);
            this.graphics.beginFill(0xfacc15, alpha * 0.25).drawCircle(it.x, iy, 13).endFill();

            // Inner solid gold coin
            this.graphics.beginFill(0xf59e0b, alpha * 0.95).drawCircle(it.x, iy, 9).endFill();
            this.graphics.lineStyle(1.5, 0xfef08a, alpha * 0.9).drawCircle(it.x, iy, 7);

            // Center coin glint
            this.graphics.beginFill(0xffffff, alpha * 0.95).drawCircle(it.x - 2, iy - 2, 2.2).endFill();
        }

        // 4. Towers & Range Overlays (Single + Multi-Selection)
        this.towers.draw(this.graphics, this.worldContainer, this.selectedTower, null, this.selectedTowers);

        // 5. Enemies & Health Bars
        this.enemies.draw(this.graphics, this.worldContainer, this.selectedEnemy);

        // 6. Marquee Drag-Box Selection (Desktop)
        if (this.isBoxSelecting && this.boxStartPos && this.boxCurrentPos) {
            const minX = Math.min(this.boxStartPos.x, this.boxCurrentPos.x);
            const minY = Math.min(this.boxStartPos.y, this.boxCurrentPos.y);
            const w = Math.abs(this.boxCurrentPos.x - this.boxStartPos.x);
            const h = Math.abs(this.boxCurrentPos.y - this.boxStartPos.y);

            this.graphics.lineStyle(1.5, 0x38bdf8, 0.95).drawRoundedRect(minX, minY, w, h, 4);
            this.graphics.beginFill(0x38bdf8, 0.15).drawRoundedRect(minX, minY, w, h, 4).endFill();
        }

        // 7. Tower Placement Preview
        if (this.previewTile && this.selectedTowerTypeIdx >= 0) {
            const towerType = CONFIG.towers[this.selectedTowerTypeIdx];
            const px = this.previewTile.x * CONFIG.gameSettings.tileSize;
            const py = this.previewTile.y * CONFIG.gameSettings.tileSize;
            const cx = px + CONFIG.gameSettings.tileSize / 2;
            const cy = py + CONFIG.gameSettings.tileSize / 2;

            this.graphics.lineStyle(2, towerType.color || 0x38bdf8, 0.45).drawCircle(cx, cy, towerType.range);
            this.graphics.beginFill(towerType.color || 0x38bdf8, 0.15).drawRoundedRect(px + 2, py + 2, 44, 44, 6).endFill();
        }

        // 8. Bomb Placement Blast Radius Preview & Target Lock-On
        if (this.placingBomb && this.pointerWorldPos) {
            const radius = BOMB_CONFIG.radius || 120;
            const pulse = 1 + Math.sin(pulseTime * 0.008) * 0.04;
            const bombColor = BOMB_CONFIG.color || 0xff3300;

            // Outer pulsing blast radius zone
            this.graphics.lineStyle(2.5, bombColor, 0.85).drawCircle(this.pointerWorldPos.x, this.pointerWorldPos.y, radius * pulse);
            this.graphics.beginFill(bombColor, 0.18).drawCircle(this.pointerWorldPos.x, this.pointerWorldPos.y, radius * pulse).endFill();

            // Inner danger core
            this.graphics.lineStyle(1.5, 0xffdd00, 0.75).drawCircle(this.pointerWorldPos.x, this.pointerWorldPos.y, radius * 0.45);
            this.graphics.beginFill(0xffdd00, 0.08).drawCircle(this.pointerWorldPos.x, this.pointerWorldPos.y, radius * 0.45).endFill();

            // Tactical targeting crosshair reticle
            this.graphics.lineStyle(2, bombColor, 0.9);
            this.graphics.moveTo(this.pointerWorldPos.x - 16, this.pointerWorldPos.y).lineTo(this.pointerWorldPos.x + 16, this.pointerWorldPos.y);
            this.graphics.moveTo(this.pointerWorldPos.x, this.pointerWorldPos.y - 16).lineTo(this.pointerWorldPos.x, this.pointerWorldPos.y + 16);

            // Highlight all in-range enemies with red lock-on target rings
            for (const e of this.enemies.enemies) {
                if (!e.alive) continue;
                if (Math.hypot(e.x - this.pointerWorldPos.x, e.y - this.pointerWorldPos.y) <= radius) {
                    this.graphics.lineStyle(2, 0xff2244, 0.9).drawCircle(e.x, e.y, (e.isBoss ? 28 : 16));
                }
            }
        }
    }

    // --- UI Setup & Modals ---
    setupUIHandlers() {
        // Start Wave Button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) startBtn.onclick = () => this.startWave();

        // Boost Button
        const boostBtn = document.getElementById('boost-btn');
        if (boostBtn) boostBtn.onclick = () => this.activateBoost();

        // Bomb Button
        const bombBtn = document.getElementById('place-bomb-btn');
        if (bombBtn) bombBtn.onclick = () => this.toggleBombPlacement();

        // Shop Button
        const shopBtn = document.getElementById('shop-btn');
        if (shopBtn) shopBtn.onclick = () => this.toggleShopModal();
        const shopClose = document.getElementById('shop-close-btn');
        if (shopClose) shopClose.onclick = () => this.toggleShopModal(false);

        // Save Game Buttons
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) saveBtn.onclick = () => this.saveCurrentGame();
        const actionSaveBtn = document.getElementById('action-save-btn');
        if (actionSaveBtn) actionSaveBtn.onclick = () => this.saveCurrentGame();

        // Load Game Buttons
        const loadBtn = document.getElementById('load-btn');
        if (loadBtn) loadBtn.onclick = () => this.ui.openLoadModal(this.saveManager, this);
        const actionLoadBtn = document.getElementById('action-load-btn');
        if (actionLoadBtn) actionLoadBtn.onclick = () => this.ui.openLoadModal(this.saveManager, this);
        const loadClose = document.getElementById('load-close-btn');
        if (loadClose) loadClose.onclick = () => this.ui.closeLoadModal();

        // Map Modal Close Button (defaults to Open Plains active map)
        const mapClose = document.getElementById('map-close-btn');
        if (mapClose) {
            mapClose.onclick = () => {
                this.mapManager.setMap('open_plains');
                this.ui.closeMapModal();
                this.restartGame(false);
                this.ui.showToast('Battlefield: Open Plains deployed!', '#38bdf8');
            };
        }

        // Speed Buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.onclick = () => {
                const spd = parseFloat(btn.dataset.speed);
                if (spd === 0) this.togglePause();
                else this.setSpeed(spd);
            };
        });

        // Audio Toggle Button
        const audioBtn = document.getElementById('audio-toggle-btn');
        if (audioBtn) {
            audioBtn.onclick = () => {
                const muted = Audio.toggleMute();
                this.updateUI();
                this.ui.showToast(muted ? 'Sound Muted 🔇' : 'Sound Unmuted 🔊', '#38bdf8', 1200);
            };
        }

        // Range Overlay Toggle Button
        const rangeBtn = document.getElementById('range-toggle-btn');
        if (rangeBtn) {
            rangeBtn.onclick = () => {
                this.towers.showAllRanges = !this.towers.showAllRanges;
                this.updateUI();
            };
        }

        // Auto-Wave Toggle Button
        const autoWaveBtn = document.getElementById('auto-wave-btn');
        if (autoWaveBtn) {
            autoWaveBtn.onclick = () => {
                this.autoWave = !this.autoWave;
                this.ui.showToast(this.autoWave ? 'Auto-Wave: Enabled ⚡' : 'Auto-Wave: Disabled', '#38bdf8', 1200);
                this.updateUI();
            };
        }

        // Cheat Sheet Trigger
        const cheatBtn = document.getElementById('cheat-sheet-btn');
        if (cheatBtn) cheatBtn.onclick = () => this.ui.openCheatSheetModal();
        const cheatClose = document.getElementById('cheat-close-btn');
        if (cheatClose) cheatClose.onclick = () => this.ui.closeCheatSheetModal();

        // Star Relic Vault Trigger
        const relicBtn = document.getElementById('relic-vault-btn');
        if (relicBtn) relicBtn.onclick = () => this.ui.openRelicModal(this.meta, this);
        const relicClose = document.getElementById('relic-close-btn');
        if (relicClose) relicClose.onclick = () => this.ui.closeRelicModal();

        // Mobile Tabs
        document.querySelectorAll('#mobile-tabs .tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#mobile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.tab;
                document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
                const p = document.getElementById(`tab-${target}`);
                if (p) p.style.display = 'flex';
            };
        });
    }

    renderTowerSelect() {
        const container = document.getElementById('tower-select');
        if (!container) return;
        container.innerHTML = '';

        CONFIG.towers.forEach((t, i) => {
            const btn = document.createElement('button');
            btn.className = `tower-btn ${this.selectedTowerTypeIdx === i ? 'selected' : ''}`;
            const colorHex = '#' + parseInt(t.color).toString(16).padStart(6, '0');
            const imgPath = t.image ? `Game_Images/${t.image}` : '';

            btn.innerHTML = `
                <div class="tower-icon-wrapper" style="background: ${colorHex}33; border-color: ${colorHex}66;">
                    ${imgPath ? `<div class="tower-icon-img" style="background-image:url('${imgPath}')"></div>` : `<div class="tower-icon-emoji">🏰</div>`}
                </div>
                <div class="tower-meta-info">
                    <div class="tower-meta-name">${t.name}</div>
                    <div class="tower-meta-sub">
                        <span class="hide-mobile">[${t.key}]</span>
                        <span class="tower-cost-pill">🪙 ${t.cost}</span>
                    </div>
                </div>
                <button class="tower-info-trigger" type="button" title="Inspect Stats">i</button>
            `;

            btn.onclick = e => {
                if (e.target.closest('.tower-info-trigger')) {
                    e.stopPropagation();
                    this.showTowerTypeInfoModal(t);
                    return;
                }
                this.selectedTowerTypeIdx = this.selectedTowerTypeIdx === i ? -1 : i;
                this.placingBomb = false;
                this.selectedTower = null;
                this.selectedTowers = [];
                this.renderTowerSelect();
            };

            container.appendChild(btn);
        });
    }

    renderWaveInfo() {
        const container = document.getElementById('wave-info-content');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < 5; i++) {
            const wNum = this.wave + i;
            const pat = this.getWavePattern(wNum);
            const item = document.createElement('div');
            item.className = `wave-info-item ${i === 0 ? 'current' : ''}`;
            item.innerHTML = `
                <div class="wave-left-group">
                    <span class="wave-info-num">W${wNum}</span>
                    <span class="wave-info-icon">${pat.icon}</span>
                    <span class="wave-info-name">${pat.name}</span>
                </div>
                <span class="wave-info-tag">${i === 0 ? '🔥 ACTIVE' : `+${i} wave`}</span>
            `;
            container.appendChild(item);
        }
    }

    updateUI() {
        this.ui.updateHeaderStats({
            gold: this.gold,
            lives: this.lives,
            wave: this.wave,
            enemiesLeft: this.enemies.enemies.length + this.enemySpawnQueue.length,
            speed: this.gameSpeed,
            isPaused: this.isPaused,
            autoWave: this.autoWave,
            stars: this.meta.getStars(),
            muted: Audio.isMuted(),
            showRanges: this.towers.showAllRanges,
            isGameRunning: this.isGameRunning
        });

        const bombBtn = document.getElementById('place-bomb-btn');
        if (bombBtn) {
            bombBtn.innerHTML = `💣 Place Bomb [X] (${this.bombCount})`;
            bombBtn.classList.toggle('active', this.placingBomb);
        }

        const boostBtn = document.getElementById('boost-btn');
        if (boostBtn) {
            if (this.boostActive) {
                boostBtn.innerHTML = '⚡ BOOST ACTIVE!';
                boostBtn.style.background = '#eab308';
                boostBtn.style.opacity = '1';
                boostBtn.style.pointerEvents = 'none';
            } else if (this.boostUsedThisWave) {
                boostBtn.innerHTML = '⚡ Boost Used (1/Wave)';
                boostBtn.style.background = '#475569';
                boostBtn.style.opacity = '0.6';
                boostBtn.style.pointerEvents = 'none';
            } else {
                boostBtn.innerHTML = '⚡ Boost [B] (1/Wave)';
                boostBtn.style.background = '#10b981';
                boostBtn.style.opacity = '1';
                boostBtn.style.pointerEvents = 'auto';
            }
        }
    }

    showTowerStatsModal(tower) {
        const modal = document.getElementById('tower-info-modal');
        if (!modal) return;

        const title = document.getElementById('tower-info-modal-title');
        const content = document.getElementById('tower-info-modal-content');

        if (title) title.textContent = `${tower.type.name} (Level ${tower.level})${tower.specialization ? ` • ${tower.specialization.name}` : ''}`;

        const discount = this.meta.getUpgradeDiscount();
        const upCost = this.towers.getUpgradeCost(tower, CONFIG.gameSettings.upgradeCostMultiplier || 0.7, discount);
        const sellVal = this.towers.getSellValue(tower, CONFIG.gameSettings.sellRefundRatio || 0.5, CONFIG.gameSettings.sellGracePeriodSeconds || 5, this.wave, this.isGameRunning);
        const isGrace = (Date.now() - tower.placedAtTime) <= ((CONFIG.gameSettings.sellGracePeriodSeconds || 5) * 1000);
        const repairCost = this.towers.getRepairCost(tower);
        const hpPercent = Math.max(0, Math.min(100, Math.round(((tower.hp || tower.maxHp) / (tower.maxHp || 250)) * 100)));
        const hpColor = hpPercent > 50 ? '#10b981' : (hpPercent > 25 ? '#facc15' : '#f43f5e');

        // Specialization choice cards if level >= 4 and no spec chosen yet
        let specHtml = '';
        const specs = SPECIALIZATIONS[tower.baseType.name] || [];
        const currentStars = this.meta ? this.meta.getStars() : 0;
        const canAffordSpec = currentStars >= 1;

        if (tower.level >= 4 && !tower.specialization && specs.length > 0) {
            specHtml = `
                <div class="spec-prompt-box">
                    <div class="spec-prompt-title">🌟 CHOOSE SPECIALIZATION (Cost: 1 ⭐ Star)</div>
                    <div class="spec-cards-container">
                        ${specs.map(s => `
                            <div class="spec-card">
                                <div class="spec-card-head">
                                    <span>${s.icon} <strong>${s.name}</strong></span>
                                </div>
                                <div class="spec-card-desc">${s.desc}</div>
                                <button class="spec-choose-btn" data-spec="${s.id}" ${!canAffordSpec ? 'style="opacity:0.6;"' : ''}>Unlock (1 ⭐ Star)</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const repairBtnHtml = (tower.hp < tower.maxHp) ? `
            <button id="modal-repair-btn" class="btn-repair" style="width:100%; padding:10px; margin-top:8px; font-size:0.9em;">
                🔧 Repair Tower [R] (🪙${repairCost}g)
            </button>
        ` : '';

        if (content) {
            content.innerHTML = `
                <div style="background:rgba(15,23,42,0.8); border:1px solid var(--border-subtle); border-radius:6px; padding:6px 10px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8em; font-weight:800; margin-bottom:4px;">
                        <span>Structure Integrity:</span>
                        <span style="color:${hpColor};">${tower.hp || tower.maxHp} / ${tower.maxHp || 250} HP (${hpPercent}%)</span>
                    </div>
                    <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
                        <div style="width:${hpPercent}%; height:100%; background:${hpColor}; transition:width 0.2s ease;"></div>
                    </div>
                </div>
                <div class="tower-sheet-grid">
                    <div class="sheet-stat"><strong>Damage:</strong> ${Math.round(tower.type.damage * tower.level)}</div>
                    <div class="sheet-stat"><strong>DPS:</strong> ${( (tower.type.damage * tower.level) / tower.type.fireRate ).toFixed(1)}</div>
                    <div class="sheet-stat"><strong>Range:</strong> ${tower.type.range}px</div>
                    <div class="sheet-stat"><strong>Fire Rate:</strong> ${(1 / tower.type.fireRate).toFixed(1)}/s</div>
                    <div class="sheet-stat"><strong>Crit:</strong> ${(tower.type.critChance * 100).toFixed(0)}% (x${tower.type.critMultiplier})</div>
                    <div class="sheet-stat"><strong>Element:</strong> ${tower.type.element}</div>
                </div>
                <div class="tower-metrics-bar">
                    <span>💥 Lifetime Damage: <strong>${Math.round(tower.lifetimeDamage || 0).toLocaleString()}</strong></span>
                    <span>💀 Kills: <strong>${tower.lifetimeKills || 0}</strong></span>
                </div>
                <div class="targeting-mode-row">
                    <span>Targeting Mode:</span>
                    <button id="cycle-target-btn" class="target-badge-btn">${tower.targetingMode.toUpperCase()}</button>
                </div>
                ${specHtml}
                ${repairBtnHtml}
                <div class="modal-actions-row">
                    <button id="modal-upgrade-btn" class="btn-upgrade">Upgrade [U] (🪙${upCost})</button>
                    <button id="modal-sell-btn" class="btn-sell">Sell [S] (🪙${sellVal})${isGrace ? ' [100% Grace]' : ''}</button>
                </div>
            `;

            // Repair click
            const repBtn = content.querySelector('#modal-repair-btn');
            if (repBtn) {
                repBtn.onclick = (e) => {
                    if (e) { e.stopPropagation(); e.preventDefault(); }
                    this.repairTower(tower);
                };
            }

            // Spec button clicks
            content.querySelectorAll('.spec-choose-btn').forEach(btn => {
                btn.onclick = () => {
                    const specId = btn.dataset.spec;
                    if (!this.meta || this.meta.getStars() < 1) {
                        this.ui.showToast('Not enough Stars! (Needs 1 ⭐)', '#f43f5e');
                        Audio.playLifeLost();
                        return;
                    }
                    if (this.towers.applySpecialization(tower, specId)) {
                        this.meta.addStar(-1);
                        Audio.playUpgrade();
                        this.ui.showToast(`Specialization unlocked (-1 ⭐ Star)!`, '#10b981');
                        this.updateUI();
                        this.showTowerStatsModal(tower);
                    }
                };
            });

            // Target cycle click
            const targetBtn = content.querySelector('#cycle-target-btn');
            if (targetBtn) {
                targetBtn.onclick = () => {
                    const m = this.towers.cycleTargetingMode(tower);
                    targetBtn.textContent = m.toUpperCase();
                };
            }

            // Upgrade click
            const upBtn = content.querySelector('#modal-upgrade-btn');
            if (upBtn) upBtn.onclick = () => this.upgradeTower(tower);

            // Sell click
            const sellBtn = content.querySelector('#modal-sell-btn');
            if (sellBtn) sellBtn.onclick = () => this.sellTower(tower);
        }

        const closeBtn = document.getElementById('tower-info-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                this.selectedTower = null;
                this.selectedTowers = [];
                this.closeTowerStatsModal();
            };
        }

        modal.style.display = 'flex';
    }

    // --- Multi-Tower Batch Management Modal ---
    showMultiTowerStatsModal(towersList) {
        const modal = document.getElementById('tower-info-modal');
        if (!modal) return;

        const title = document.getElementById('tower-info-modal-title');
        const content = document.getElementById('tower-info-modal-content');

        if (title) title.textContent = `🛡️ Batch Defense Selection (${towersList.length} Towers)`;

        const discount = this.meta.getUpgradeDiscount();
        const mult = CONFIG.gameSettings.upgradeCostMultiplier || 0.7;

        // Calculate Collective Metrics
        let totalDps = 0;
        let totalLifetimeDamage = 0;
        let totalKills = 0;
        let totalUpgradeCost = 0;
        let totalSellRefund = 0;
        let totalRepairCost = 0;
        let damagedCount = 0;

        for (const t of towersList) {
            const dps = (t.type.damage * t.level) / t.type.fireRate;
            totalDps += dps;
            totalLifetimeDamage += (t.lifetimeDamage || 0);
            totalKills += (t.lifetimeKills || 0);
            totalUpgradeCost += this.towers.getUpgradeCost(t, mult, discount);
            totalSellRefund += this.towers.getSellValue(
                t,
                CONFIG.gameSettings.sellRefundRatio || 0.5,
                CONFIG.gameSettings.sellGracePeriodSeconds || 5,
                this.wave,
                this.isGameRunning
            );
            if (t.hp !== undefined && t.maxHp && t.hp < t.maxHp) {
                damagedCount++;
                totalRepairCost += this.towers.getRepairCost(t);
            }
        }

        // Group by Archetype Name
        const groups = {};
        for (const t of towersList) {
            const key = t.baseType.name;
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }

        let groupCardsHtml = '';
        for (const [name, gTowers] of Object.entries(groups)) {
            const minLvl = Math.min(...gTowers.map(t => t.level));
            const maxLvl = Math.max(...gTowers.map(t => t.level));
            const lvlText = minLvl === maxLvl ? `Level ${minLvl}` : `Levels ${minLvl}-${maxLvl}`;
            const gUpCost = gTowers.reduce((sum, t) => sum + this.towers.getUpgradeCost(t, mult, discount), 0);
            const gSellVal = gTowers.reduce((sum, t) => sum + this.towers.getSellValue(t, CONFIG.gameSettings.sellRefundRatio || 0.5, CONFIG.gameSettings.sellGracePeriodSeconds || 5, this.wave, this.isGameRunning), 0);

            // Specialization prompt if any in this group need it
            let specHtml = '';
            const unspec = gTowers.filter(t => t.level >= 4 && !t.specialization);
            const specs = SPECIALIZATIONS[name] || [];
            if (unspec.length > 0 && specs.length > 0) {
                specHtml = `
                    <div style="background:rgba(236,72,153,0.15); border:1px solid rgba(236,72,153,0.3); border-radius:6px; padding:6px; margin:4px 0;">
                        <div style="font-size:0.75em; font-weight:800; color:#f472b6; margin-bottom:4px;">🌟 ${unspec.length} UNCHOSEN SPECIALIZATION(S) (Cost: 1 ⭐ / Tower)</div>
                        <div style="display:flex; gap:4px;">
                            ${specs.map(s => `
                                <button class="spec-group-choose-btn" data-type="${name}" data-spec="${s.id}" style="flex:1; background:#ec4899; color:#fff; border:none; padding:4px; font-size:0.72em; font-weight:800; border-radius:4px; cursor:pointer;">
                                    ${s.icon} ${s.name} (${unspec.length} ⭐)
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            groupCardsHtml += `
                <div class="batch-group-card">
                    <div class="batch-group-header">
                        <span>🏰 ${name} (${gTowers.length}x) • <span style="color:#38bdf8;">${lvlText}</span></span>
                        <span style="font-size:0.8em; color:#94a3b8;">${gTowers[0].type.element}</span>
                    </div>
                    ${specHtml}
                    <div class="batch-group-actions">
                        <button class="batch-sub-btn batch-sub-up" data-group="${name}">Upgrade Group (🪙${gUpCost})</button>
                        <button class="batch-sub-btn batch-sub-sell" data-group="${name}">Sell Group (🪙${gSellVal})</button>
                    </div>
                </div>
            `;
        }

        if (content) {
            content.innerHTML = `
                <div class="batch-summary-box">
                    <div><strong>Total DPS:</strong> <span style="color:#38bdf8;">${totalDps.toFixed(1)}</span></div>
                    <div><strong>Lifetime Dmg:</strong> <span style="color:#facc15;">${Math.round(totalLifetimeDamage).toLocaleString()}</span></div>
                    <div><strong>Kills:</strong> <span style="color:#f43f5e;">${totalKills}</span></div>
                </div>

                <div style="margin-top:6px;">
                    <div style="font-size:0.75em; font-weight:800; color:var(--text-secondary); text-transform:uppercase; margin-bottom:2px;">Sync All Targeting AI</div>
                    <div class="batch-targeting-strip">
                        ${['first', 'last', 'strongest', 'weakest', 'fastest', 'flying', 'closest'].map(m => `
                            <button class="batch-target-btn" data-target="${m}">${m.toUpperCase()}</button>
                        `).join('')}
                    </div>
                </div>

                <div style="font-size:0.75em; font-weight:800; color:var(--text-secondary); text-transform:uppercase; margin-top:6px;">Selected Groups Breakdown</div>
                <div class="batch-groups-container">
                    ${groupCardsHtml}
                </div>

                <div class="batch-actions-grid">
                    ${damagedCount > 0 ? `
                        <button id="batch-repair-all-btn" class="btn-repair" style="grid-column:span 2; padding:10px; font-size:0.85em;">
                            🔧 Repair ${damagedCount} Damaged Tower(s) [R] (🪙${totalRepairCost}g)
                        </button>
                    ` : ''}
                    <button id="batch-upgrade-all-btn" class="btn-upgrade" style="padding:10px; font-size:0.85em;">🔼 Upgrade All [U] (🪙${totalUpgradeCost})</button>
                    <button id="batch-sell-all-btn" class="btn-sell" style="padding:10px; font-size:0.85em;">💰 Sell All [S] (🪙${totalSellRefund})</button>
                </div>
            `;

            // Batch Repair click
            const repAllBtn = content.querySelector('#batch-repair-all-btn');
            if (repAllBtn) {
                repAllBtn.onclick = (e) => {
                    if (e) { e.stopPropagation(); e.preventDefault(); }
                    this.repairAllTowers(this.selectedTowers);
                };
            }

            // Global Upgrade All click
            const upAllBtn = content.querySelector('#batch-upgrade-all-btn');
            if (upAllBtn) upAllBtn.onclick = () => this.batchUpgradeTowers(this.selectedTowers);

            // Global Sell All click
            const sellAllBtn = content.querySelector('#batch-sell-all-btn');
            if (sellAllBtn) sellAllBtn.onclick = () => this.batchSellTowers(this.selectedTowers);

            // Global Targeting buttons
            content.querySelectorAll('.batch-target-btn').forEach(btn => {
                btn.onclick = () => this.batchSetTargeting(this.selectedTowers, btn.dataset.target);
            });

            // Group Upgrade buttons
            content.querySelectorAll('.batch-sub-up').forEach(btn => {
                btn.onclick = () => {
                    const gName = btn.dataset.group;
                    const gList = this.selectedTowers.filter(t => t.baseType.name === gName);
                    this.batchUpgradeTowers(gList);
                };
            });

            // Group Sell buttons
            content.querySelectorAll('.batch-sub-sell').forEach(btn => {
                btn.onclick = () => {
                    const gName = btn.dataset.group;
                    const gList = this.selectedTowers.filter(t => t.baseType.name === gName);
                    this.batchSellTowers(gList);
                };
            });

            // Spec buttons inside groups
            content.querySelectorAll('.spec-group-choose-btn').forEach(btn => {
                btn.onclick = () => {
                    const gName = btn.dataset.type;
                    const specId = btn.dataset.spec;
                    const unspec = this.selectedTowers.filter(t => t.baseType.name === gName && t.level >= 4 && !t.specialization);
                    const neededStars = unspec.length;
                    if (!this.meta || this.meta.getStars() < neededStars) {
                        this.ui.showToast(`Not enough Stars! (Needs ${neededStars} ⭐ for ${unspec.length} towers)`, '#f43f5e');
                        Audio.playLifeLost();
                        return;
                    }
                    this.meta.addStar(-neededStars);
                    unspec.forEach(t => this.towers.applySpecialization(t, specId));
                    Audio.playUpgrade();
                    this.ui.showToast(`Applied specialization to ${unspec.length} ${gName} tower(s) (-${neededStars} ⭐)!`, '#10b981');
                    this.updateUI();
                    this.showMultiTowerStatsModal(this.selectedTowers);
                };
            });
        }

        const closeBtn = document.getElementById('tower-info-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                this.selectedTowers = [];
                this.selectedTower = null;
                this.closeTowerStatsModal();
            };
        }

        modal.style.display = 'flex';
    }

    closeTowerStatsModal() {
        this.ignoreCanvasClickUntil = Date.now() + 400;
        const modal = document.getElementById('tower-info-modal');
        if (modal) modal.style.display = 'none';
        this.selectedTower = null;
        this.selectedTowers = [];
        if (this.app && this.app.view) {
            this.app.view.style.pointerEvents = 'none';
            setTimeout(() => {
                if (this.app && this.app.view) {
                    this.app.view.style.pointerEvents = 'auto';
                }
            }, 300);
        }
    }

    showTowerTypeInfoModal(towerType) {
        const modal = document.getElementById('tower-info-modal');
        if (!modal) return;

        const title = document.getElementById('tower-info-modal-title');
        const content = document.getElementById('tower-info-modal-content');

        if (title) title.textContent = `${towerType.name} Tower [${towerType.key}]`;
        if (content) {
            content.innerHTML = `
                <div class="tower-sheet-grid">
                    <div class="sheet-stat"><strong>Cost:</strong> 🪙 ${towerType.cost}</div>
                    <div class="sheet-stat"><strong>Damage:</strong> ${towerType.damage}</div>
                    <div class="sheet-stat"><strong>Range:</strong> ${towerType.range}px</div>
                    <div class="sheet-stat"><strong>Fire Rate:</strong> ${(1 / towerType.fireRate).toFixed(1)}/s</div>
                    <div class="sheet-stat"><strong>Element:</strong> ${towerType.element}</div>
                </div>
                <div style="font-size:0.85em; color:#94a3b8; margin:8px 0; font-style:italic;">"${towerType.description || ''}"</div>
                <div style="font-size:0.8em; color:#86efac; background:rgba(16,185,129,0.1); padding:6px; border-radius:6px;">💡 <strong>Tip:</strong> ${towerType.tips || ''}</div>
            `;
        }

        const closeBtn = document.getElementById('tower-info-close-btn');
        if (closeBtn) closeBtn.onclick = () => this.closeTowerStatsModal();

        modal.style.display = 'flex';
    }

    showEnemyStats(enemy) {
        const panel = document.getElementById('stats-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div style="font-weight:700; color:#fff; margin-bottom:4px;">${enemy.type.emoji || '👾'} ${enemy.type.name} Enemy</div>
            <div>HP: <strong>${Math.round(enemy.hp)} / ${enemy.maxHp}</strong></div>
            <div>Speed: <strong>${enemy.speed.toFixed(2)}</strong></div>
            <div>Element: <strong>${enemy.type.element}</strong></div>
            ${enemy.trait ? `<div style="color:#38bdf8;">Trait: <strong>${enemy.trait.toUpperCase()}</strong></div>` : ''}
        `;
    }

    hideStatsPanel() {
        const panel = document.getElementById('stats-panel');
        if (panel) {
            panel.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:10px 0;">Tap any enemy or tower on map to inspect stats.</div>`;
        }
    }

    // --- Rich Shop Modal ---
    toggleShopModal(show = true) {
        const modal = document.getElementById('shop-modal');
        if (!modal) return;

        if (!show || modal.style.display === 'flex') {
            modal.style.display = 'none';
            return;
        }

        // Render Rich Shop Cards
        const container = document.getElementById('shop-items-container');
        if (container) {
            container.innerHTML = '';

            // 1. Star Exchange: +1 Life
            const starCount = this.meta ? this.meta.getStars() : 0;
            const canAffordLife = starCount >= 1;
            const lifeCard = document.createElement('div');
            lifeCard.className = 'shop-bomb-item';
            lifeCard.style.background = 'rgba(239, 68, 68, 0.12)';
            lifeCard.style.borderColor = 'rgba(239, 68, 68, 0.35)';
            lifeCard.innerHTML = `
                <div class="bomb-preview">❤️</div>
                <div class="shop-tower-info">
                    <div class="shop-tower-name" style="color:#f87171;">Buy +1 Life [⭐ Star Market]</div>
                    <div class="shop-tower-stats">
                        Instantly gain +1 base life.<br>
                        Current Lives: <strong>${this.lives}</strong> | Your Stars: <strong>${starCount} ⭐</strong>
                    </div>
                </div>
                <button class="shop-tower-price" style="background:#ef4444;" ${!canAffordLife ? 'disabled' : ''}>
                    Exchange: 1 ⭐ Star
                </button>
            `;
            lifeCard.querySelector('button').onclick = () => {
                if (this.meta && this.meta.getStars() >= 1) {
                    this.meta.addStar(-1);
                    this.lives++;
                    Audio.playBuy();
                    this.ui.showToast(`+1 Life Purchased! (❤️ ${this.lives})`, '#ef4444');
                    this.updateUI();
                    this.toggleShopModal(true);
                }
            };
            container.appendChild(lifeCard);

            // 2. Star Exchange: Gold (50 + 5 * wave)
            const goldForStar = 50 + (5 * this.wave);
            const canAffordGold = starCount >= 1;
            const goldCard = document.createElement('div');
            goldCard.className = 'shop-bomb-item';
            goldCard.style.background = 'rgba(250, 204, 21, 0.12)';
            goldCard.style.borderColor = 'rgba(250, 204, 21, 0.35)';
            goldCard.innerHTML = `
                <div class="bomb-preview">🪙</div>
                <div class="shop-tower-info">
                    <div class="shop-tower-name" style="color:#facc15;">Buy +${goldForStar}g Gold [⭐ Star Market]</div>
                    <div class="shop-tower-stats">
                        Scales with Wave ${this.wave} (50 + 5 × Wave).<br>
                        Current Gold: <strong>${Math.floor(this.gold)}g</strong> | Your Stars: <strong>${starCount} ⭐</strong>
                    </div>
                </div>
                <button class="shop-tower-price" style="background:#eab308; color:#0f172a;" ${!canAffordGold ? 'disabled' : ''}>
                    Exchange: 1 ⭐ Star
                </button>
            `;
            goldCard.querySelector('button').onclick = () => {
                if (this.meta && this.meta.getStars() >= 1) {
                    this.meta.addStar(-1);
                    this.gold += goldForStar;
                    Audio.playCoin();
                    this.ui.showToast(`+${goldForStar}g Gold Purchased!`, '#facc15');
                    this.updateUI();
                    this.toggleShopModal(true);
                }
            };
            container.appendChild(goldCard);

            // 3. Explosive Bomb Card
            const bombCard = document.createElement('div');
            bombCard.className = 'shop-bomb-item';
            const bombPrice = BOMB_CONFIG.shopPrice || 300;
            const canAffordBomb = this.gold >= bombPrice;

            bombCard.innerHTML = `
                <div class="bomb-preview">💣</div>
                <div class="shop-tower-info">
                    <div class="shop-tower-name">${BOMB_CONFIG.name || 'Explosive Bomb'} [${BOMB_CONFIG.key || 'X'}]</div>
                    <div class="shop-tower-stats">
                        Damage: Up to ${BOMB_CONFIG.damage || 300} | Radius: ${BOMB_CONFIG.radius || 120}px<br>
                        You have: ${this.bombCount} bombs
                    </div>
                </div>
                <button class="shop-tower-price" ${!canAffordBomb ? 'disabled' : ''}>
                    Buy: ${bombPrice} Gold
                </button>
            `;
            bombCard.querySelector('button').onclick = () => {
                if (this.gold >= bombPrice) {
                    this.gold -= bombPrice;
                    this.bombCount++;
                    Audio.playCoin();
                    this.ui.showToast('+1 Explosive Bomb Purchased!', '#ff5500');
                    this.updateUI();
                    this.toggleShopModal(true);
                }
            };
            container.appendChild(bombCard);

            // 2. Advanced Shop Towers
            const discount = this.meta.getShopDiscount();

            CONFIG.shopTowers.forEach(st => {
                const isPurchased = CONFIG.towers.some(t => t.name === st.name);
                const imageFile = st.image ? `Game_Images/${st.image}` : null;
                const baseDamage = st.damage;
                const variation = st.damageVariation || 0.15;
                const minDamage = Math.floor(baseDamage * (1 - variation));
                const maxDamage = Math.ceil(baseDamage * (1 + variation));
                const critChance = (st.critChance || 0.15) * 100;
                const damagePerSec = baseDamage / (st.fireRate || 0.3);
                const elInfo = ELEMENTS[st.element] || { name: 'Physical', emoji: '⚔️' };

                let specialText = '';
                if (st.name === 'Slow') {
                    specialText = `<br><span style="color:#67e8f9;">❄️ Slow: ${(SLOW_CONFIG.slowAmount * 100).toFixed(0)}% for ${SLOW_CONFIG.slowDuration}s</span>`;
                }
                if (st.flyingOnly) {
                    specialText = `<br><span style="color:#a78bfa;">🎯 Only targets flying enemies</span>`;
                }
                if (st.splashRadius > 0) {
                    specialText = `<br><span style="color:#fb923c;">💥 Splash: ${(st.splashDamageRatio * 100).toFixed(0)}% in ${st.splashRadius}px</span>`;
                }
                if (st.name === 'Melee') {
                    specialText = `<br><span style="color:#f87171;">⚔️ Hits all nearby ground targets</span>`;
                }

                const basePrice = st.shopPrice || 400;
                const price = Math.max(50, Math.floor(basePrice * (1 - discount)));
                const canAfford = this.gold >= price;

                const card = document.createElement('div');
                card.className = 'shop-tower-item';
                card.innerHTML = `
                    <div class="tower-preview" style="${imageFile ? `background-image:url('${imageFile}')` : `background-color:#${parseInt(st.color).toString(16).padStart(6, '0')}`}">
                        ${!imageFile && elInfo.emoji ? elInfo.emoji : ''}
                    </div>
                    <div class="shop-tower-info">
                        <div class="shop-tower-name">${st.name} Tower [${st.key}]</div>
                        <div style="font-style:italic; color:#94a3b8; font-size:0.85em; margin-bottom:3px;">${st.description || ''}</div>
                        <div class="shop-tower-stats">
                            <strong>Damage:</strong> ${minDamage}-${maxDamage} | <strong>DPS:</strong> ${damagePerSec.toFixed(1)}<br>
                            <strong>Range:</strong> ${st.range} | <strong>Crit:</strong> ${critChance.toFixed(0)}%
                            ${specialText}
                            ${st.tips ? `<br><span style="color:#86efac;">💡 <strong>Tips:</strong> ${st.tips}</span>` : ''}
                        </div>
                    </div>
                    ${isPurchased ? `<button class="shop-tower-purchased">Purchased</button>` : `<button class="shop-tower-price" ${!canAfford ? 'disabled' : ''}>Buy: ${price} Gold</button>`}
                `;

                const btn = card.querySelector('.shop-tower-price');
                if (btn && !isPurchased) {
                    btn.onclick = () => {
                        if (this.gold >= price) {
                            this.gold -= price;
                            CONFIG.towers.push(st);
                            Audio.playUpgrade();
                            this.ui.showToast(`Unlocked ${st.name} Tower!`, '#10b981');
                            this.renderTowerSelect();
                            this.updateUI();
                            this.toggleShopModal(true);
                        }
                    };
                }

                container.appendChild(card);
            });
        }

        modal.style.display = 'flex';
    }

    handleGameOver(isVictory = false) {
        this.isGameRunning = false;
        if (!isVictory) Audio.playLifeLost();

        const mvp = this.towers.getMvpTower();
        const summary = this.meta.finalizeRun(mvp);

        this.ui.openRunSummaryModal(summary, () => {
            this.ui.openMapModal(this.mapManager, this.meta, CONFIG.difficulties);
        });
    }

    restartGame(clearStorage = false) {
        this.towers.clear();
        this.enemies.clear();
        this.effects.clear();
        this.items = [];
        this.activeEffects = [];
        this.enemySpawnQueue = [];

        this.wave = 1;
        this.endlessMode = false;
        this.isGameRunning = false;
        this.spawningWave = false;
        this.isPaused = false;
        this.bombCount = 0;
        this.placingBomb = false;
        this.selectedTowerTypeIdx = -1;
        this.selectedTower = null;
        this.selectedTowers = [];
        this.selectedEnemy = null;
        this.isBoxSelecting = false;
        this.boxStartPos = null;
        this.boxCurrentPos = null;

        // Reset camera zoom/pan
        this.viewScale = 1.0;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;
        this.updateWorldTransform();

        this.meta.resetRunStats();
        this.meta.resetStars();
        this.meta.resetRelics();
        CONFIG.towers = JSON.parse(JSON.stringify(BASE_TOWERS));
        try { localStorage.removeItem('purchasedTowers'); } catch { }
        try { localStorage.removeItem('td_meta_stars'); } catch { }
        try { localStorage.removeItem('td_meta_relics'); } catch { }
        this.initStartingResources();
        this.refreshGrid();
        this.renderTowerSelect();
        this.renderWaveInfo();
        this.updateUI();
        this.ui.showToast('New Defense Mission Started!', '#38bdf8');
    }

    resizeCanvas() {
        const container = document.getElementById('game-canvas-container');
        if (!container || !this.app) return;

        const isMobile = window.innerWidth <= 900;
        let size;
        if (isMobile) {
            const availW = window.innerWidth - 4;
            const availH = container.clientHeight || (window.innerHeight * 0.52);
            size = Math.min(availW, availH, 750);
        } else {
            size = Math.min(container.clientWidth - 16, container.clientHeight - 16, 750);
        }

        if (size > 0) {
            this.app.view.style.width = size + 'px';
            this.app.view.style.height = size + 'px';
        }
    }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
    const game = new TowerDefenseGame();
    window.game = game;
    window.gameInstance = game;
    game.init().catch(err => console.error('Game initialization failed:', err));
});
