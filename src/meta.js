// src/meta.js - Meta Star Vault, Persistent Relics & Run Analytics

export class MetaProgressionManager {
    constructor(relicsConfig = []) {
        this.relicsConfig = relicsConfig;
        this.stars = 0;
        this.relicRanks = {};
        this.unlockedDifficulties = [1];
        this.beatenDifficulties = [];
        this.currentDifficulty = 1;
        this.runStats = this.createNewRunStats();
        this.highScores = [];

        this.loadState();
    }

    loadState() {
        try {
            const savedRelics = localStorage.getItem('td_meta_relics');
            if (savedRelics) this.relicRanks = JSON.parse(savedRelics) || {};

            const savedScores = localStorage.getItem('td_high_scores');
            if (savedScores) this.highScores = JSON.parse(savedScores) || [];

            const savedDiffs = localStorage.getItem('td_unlocked_difficulties');
            if (savedDiffs) this.unlockedDifficulties = JSON.parse(savedDiffs) || [1];

            const savedBeaten = localStorage.getItem('td_beaten_difficulties');
            if (savedBeaten) this.beatenDifficulties = JSON.parse(savedBeaten) || [];
        } catch (e) {
            console.warn('Failed to load meta state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('td_meta_relics', JSON.stringify(this.relicRanks));
            localStorage.setItem('td_high_scores', JSON.stringify(this.highScores));
            localStorage.setItem('td_unlocked_difficulties', JSON.stringify(this.unlockedDifficulties));
            localStorage.setItem('td_beaten_difficulties', JSON.stringify(this.beatenDifficulties));
        } catch (e) {
            console.warn('Failed to save meta state:', e);
        }
    }

    isDifficultyUnlocked(diffId) {
        return this.unlockedDifficulties.includes(parseInt(diffId, 10));
    }

    unlockDifficulty(diffId) {
        const id = parseInt(diffId, 10);
        if (!this.unlockedDifficulties.includes(id)) {
            this.unlockedDifficulties.push(id);
            this.addStar(5); // +5 Star Tokens reward for unlocking a new difficulty in this run!
            this.saveState();
            return true;
        }
        return false;
    }

    recordDifficultyBeaten(diffId) {
        const id = parseInt(diffId, 10);
        if (!this.beatenDifficulties.includes(id)) {
            this.beatenDifficulties.push(id);
            this.saveState();
        }
        // Unlock next tier
        if (id < 3) {
            this.unlockDifficulty(id + 1);
        }
    }

    getDifficulty() {
        return this.currentDifficulty;
    }

    setDifficulty(diffId) {
        const id = parseInt(diffId, 10);
        if (this.isDifficultyUnlocked(id)) {
            this.currentDifficulty = id;
            return true;
        }
        return false;
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

    resetStars() {
        this.stars = 0;
    }

    resetRelics() {
        this.relicRanks = {};
    }

    setStars(amount = 0) {
        this.stars = Math.max(0, parseInt(amount, 10) || 0);
    }

    addStar(amount = 1) {
        this.stars = Math.max(0, this.stars + amount);
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
        const cost = 1; // 1 Star per rank upgrade
        if (this.stars < cost) return false;

        this.stars -= cost;
        this.relicRanks[relicId] = currentRank + 1;
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
