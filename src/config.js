// src/config.js - Game Configuration Loader & State Cache

export let CONFIG = null;
export let BASE_TOWERS = [];
export let ELEMENTS = {};
export let SLOW_CONFIG = {};
export let BOOST_CONFIG = {};
export let BOMB_CONFIG = {};
export let ITEM_TYPES = [];
export let MAPS = [];
export let RELICS = [];
export let STATUS_CONFIG = {};
export let SPECIALIZATIONS = {};

export async function loadConfig() {
    try {
        const response = await fetch('game-config.json?v=' + Date.now());
        if (!response.ok) {
            throw new Error(`Failed to load game-config.json: ${response.statusText}`);
        }
        CONFIG = await response.json();

        // Save original starter base towers (Cannon, Melee, Splash)
        BASE_TOWERS = JSON.parse(JSON.stringify(CONFIG.towers || []));

        ELEMENTS = CONFIG.elements || {};
        SLOW_CONFIG = CONFIG.slowTower || { slowAmount: 0.4, slowDuration: 2.5, effectColor: '0x88ccff' };
        BOOST_CONFIG = CONFIG.boost || { key: 'B', speedMultiplier: 2.0, duration: 5, cooldown: 25 };
        BOMB_CONFIG = CONFIG.bomb || { name: 'Explosive Bomb', shopPrice: 300, damage: 300, radius: 120, explosionDuration: 0.5, key: 'X', color: '0xff3300' };
        ITEM_TYPES = CONFIG.items || [];
        MAPS = CONFIG.maps || [];
        RELICS = CONFIG.relics || [];
        STATUS_CONFIG = CONFIG.statusEffects || {};
        SPECIALIZATIONS = CONFIG.towerSpecializations || {};

        return CONFIG;
    } catch (err) {
        console.error('Error loading game configuration:', err);
        throw err;
    }
}
