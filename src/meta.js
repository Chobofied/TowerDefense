// src/meta.js - Meta Star Vault, Persistent Relics & Run Analytics

export class MetaProgressionManager {
    constructor(relicsConfig = []) {
        this.relicsConfig = relicsConfig;
        this.stars = 0;
        this.relicRanks = {};
        this.runStats = this.createNewRunStats();
        this.highScores = [];

        this.loadState();
    }

    loadState() {
        try {
            const savedStars = localStorage.getItem('td_meta_stars');
            if (savedStars !== null) this.stars = parseInt(savedStars, 10) || 0;

            const savedRelics = localStorage.getItem('td_meta_relics');
            if (savedRelics) this.relicRanks = JSON.parse(savedRelics) || {};

            const savedScores = localStorage.getItem('td_high_scores');
            if (savedScores) this.highScores = JSON.parse(savedScores) || [];
        } catch (e) {
            console.warn('Failed to load meta state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('td_meta_stars', this.stars);
            localStorage.setItem('td_meta_relics', JSON.stringify(this.relicRanks));
            localStorage.setItem('td_high_scores', JSON.stringify(this.highScores));
        } catch (e) {
            console.warn('Failed to save meta state:', e);
        }
    }

    createNewRunStats() {
        return {
            waveReached: 1,
            enemiesSlain: 0,
            goldEarned: 0,
            damageDealt: 0,
            startTime: Date.now(),
            endTime: null,
            damageByElement: {
                physical: 0,
                fire: 0,
                water: 0,
                earth: 0,
                slow: 0
            }
        };
    }

    resetRunStats() {
        this.runStats = this.createNewRunStats();
    }

    addStar(amount = 1) {
        this.stars += amount;
        this.saveState();
    }

    getStars() {
        return this.stars;
    }

    getRelicRank(relicId) {
        return this.relicRanks[relicId] || 0;
    }

    upgradeRelic(relicId) {
        const relic = this.relicsConfig.find(r => r.id === relicId);
        if (!relic) return false;
        const currentRank = this.getRelicRank(relicId);
        if (currentRank >= relic.maxRank) return false;
        const cost = relic.costPerRank * (currentRank + 1);
        if (this.stars < cost) return false;

        this.stars -= cost;
        this.relicRanks[relicId] = currentRank + 1;
        this.saveState();
        return true;
    }

    // --- Active Relic Bonuses ---
    getStartingGoldBonus() {
        const rank = this.getRelicRank('starterTreasury');
        return rank * 50;
    }

    getStartingLivesBonus() {
        const rank = this.getRelicRank('fortifiedCore');
        return rank * 2;
    }

    getUpgradeDiscount() {
        const rank = this.getRelicRank('engineeringGuild');
        return rank * 0.06; // up to 30% discount
    }

    getShopDiscount() {
        const rank = this.getRelicRank('merchantContract');
        return rank * 0.10; // up to 40% discount
    }

    getBoostDurationBonus() {
        const rank = this.getRelicRank('overclockReactor');
        return rank * 1.0; // up to +3s boost duration
    }

    // --- Record Combat Events ---
    recordDamage(amount, element = 'physical') {
        this.runStats.damageDealt += amount;
        if (this.runStats.damageByElement[element] !== undefined) {
            this.runStats.damageByElement[element] += amount;
        } else {
            this.runStats.damageByElement.physical += amount;
        }
    }

    recordKill(rewardGold = 0) {
        this.runStats.enemiesSlain++;
        this.runStats.goldEarned += rewardGold;
    }

    recordWaveComplete(waveNum, bonusGold = 0) {
        this.runStats.waveReached = Math.max(this.runStats.waveReached, waveNum);
        this.runStats.goldEarned += bonusGold;
    }

    finalizeRun(mvpTower = null) {
        this.runStats.endTime = Date.now();
        const durationSec = Math.round((this.runStats.endTime - this.runStats.startTime) / 1000);

        const summary = {
            date: new Date().toLocaleDateString(),
            wave: this.runStats.waveReached,
            kills: this.runStats.enemiesSlain,
            damage: Math.round(this.runStats.damageDealt),
            gold: this.runStats.goldEarned,
            duration: durationSec,
            damageByElement: { ...this.runStats.damageByElement },
            mvp: mvpTower ? {
                name: mvpTower.type.name,
                level: mvpTower.level,
                spec: mvpTower.specialization ? mvpTower.specialization.name : null,
                damage: Math.round(mvpTower.lifetimeDamage || 0),
                kills: mvpTower.lifetimeKills || 0
            } : null
        };

        this.highScores.push(summary);
        this.highScores.sort((a, b) => b.wave - a.wave || b.damage - a.damage);
        if (this.highScores.length > 10) this.highScores.length = 10;
        this.saveState();

        return summary;
    }
}
