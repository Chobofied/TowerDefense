// src/save.js - Save & Load Game Manager (Multi-slot persistence)

export class SaveManager {
    constructor() {
        this.STORAGE_KEY = 'td_save_slots';
    }

    getSaveIndex() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    saveGame(game) {
        const slots = this.getSaveIndex();
        const id = 'save_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

        const currentMap = game.mapManager.getCurrentMap();
        const snapshot = {
            id,
            ts: Date.now(),
            dateStr: new Date().toLocaleString(),
            mapId: currentMap ? currentMap.id : 'plains',
            mapName: currentMap ? currentMap.name : 'Open Plains',
            wave: game.wave,
            gold: Math.floor(game.gold),
            lives: game.lives,
            bombCount: game.bombCount,
            stars: game.meta.getStars(),
            purchasedTowerNames: game.CONFIG.towers
                .filter(t => !(game.BASE_TOWERS || []).some(bt => bt.name === t.name))
                .map(t => t.name),
            towers: game.towers.towers.map(t => ({
                x: t.x,
                y: t.y,
                level: t.level,
                typeName: t.baseType.name,
                targetingMode: t.targetingMode || 'first',
                specId: t.specialization ? t.specialization.id : null,
                lifetimeDamage: t.lifetimeDamage || 0,
                lifetimeKills: t.lifetimeKills || 0
            }))
        };

        // Add to slots (keep newest first, max 10)
        slots.unshift(snapshot);
        if (slots.length > 10) slots.length = 10;

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(slots));
            return snapshot;
        } catch (e) {
            console.error('Failed to save game:', e);
            return null;
        }
    }

    loadSaveById(id) {
        const slots = this.getSaveIndex();
        return slots.find(s => s.id === id) || null;
    }

    deleteSaveById(id) {
        let slots = this.getSaveIndex();
        slots = slots.filter(s => s.id !== id);
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(slots));
            return true;
        } catch {
            return false;
        }
    }

    applySave(snapshot, game) {
        if (!snapshot) return false;

        // 1. Clean up battlefield
        game.towers.clear();
        game.enemies.clear();
        game.effects.clear();
        game.items = [];
        game.activeEffects = [];
        game.enemySpawnQueue = [];

        // 2. Set Map
        if (snapshot.mapId) {
            game.mapManager.setMap(snapshot.mapId);
        }

        // 3. Restore Base State
        game.wave = snapshot.wave || 1;
        game.gold = snapshot.gold || 500;
        game.lives = snapshot.lives || 20;
        game.bombCount = snapshot.bombCount || 0;
        game.isGameRunning = false;
        game.spawningWave = false;
        game.isPaused = false;
        game.selectedTowerTypeIdx = -1;
        game.selectedTower = null;
        game.selectedEnemy = null;
        game.placingBomb = false;

        // 4. Restore Unlocked Shop Towers
        game.CONFIG.towers = JSON.parse(JSON.stringify(game.BASE_TOWERS || []));
        if (snapshot.purchasedTowerNames && Array.isArray(snapshot.purchasedTowerNames)) {
            snapshot.purchasedTowerNames.forEach(name => {
                const shopTower = game.CONFIG.shopTowers.find(st => st.name === name);
                if (shopTower && !game.CONFIG.towers.some(t => t.name === name)) {
                    game.CONFIG.towers.push(shopTower);
                }
            });
        }

        // 5. Reconstruct Placed Towers
        if (snapshot.towers && Array.isArray(snapshot.towers)) {
            snapshot.towers.forEach(savedTower => {
                const towerType = game.CONFIG.towers.find(t => t.name === savedTower.typeName) ||
                    (game.CONFIG.shopTowers || []).find(t => t.name === savedTower.typeName) ||
                    game.CONFIG.towers[0];

                if (towerType) {
                    const tower = game.towers.createTower(towerType, savedTower.x, savedTower.y, game.wave, false);
                    tower.level = savedTower.level || 1;
                    tower.targetingMode = savedTower.targetingMode || 'first';
                    tower.lifetimeDamage = savedTower.lifetimeDamage || 0;
                    tower.lifetimeKills = savedTower.lifetimeKills || 0;

                    if (savedTower.specId) {
                        game.towers.applySpecialization(tower, savedTower.specId);
                    }
                }
            });
        }

        // 6. Refresh Grid & UI
        game.refreshGrid();
        game.renderTowerSelect();
        game.renderWaveInfo();
        game.updateUI();

        return true;
    }
}
