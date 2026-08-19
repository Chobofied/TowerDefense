// src/ui.js - Glassmorphic HUD, Modals, Cheat Sheet, Run Summary & Star Vault UI

export class UIManager {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.activeModal = null;
        this.autoWaveEnabled = false;
        this.gameSpeed = 1;
        this.isPaused = false;
    }

    // --- Toast Notifications ---
    showToast(message, color = '#ffffff', duration = 2200) {
        const container = document.getElementById('message-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'game-message';
        toast.textContent = message;
        toast.style.borderColor = color;
        toast.style.color = color;

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, duration);
    }

    // --- Header Live Stats & Speed Controls ---
    updateHeaderStats({ gold, lives, wave, enemiesLeft, speed, isPaused, autoWave, stars, muted, showRanges, isGameRunning }) {
        const goldEl = document.getElementById('gold');
        const livesEl = document.getElementById('lives');
        const waveEl = document.getElementById('wave-num');
        const enemiesEl = document.getElementById('enemies-left');
        const starsEl = document.getElementById('stars-count');

        if (goldEl) goldEl.textContent = Math.floor(gold);
        if (livesEl) livesEl.textContent = Math.max(0, lives);
        if (waveEl) waveEl.textContent = wave;
        if (enemiesEl) enemiesEl.textContent = enemiesLeft;
        if (starsEl) starsEl.textContent = stars || 0;

        this.gameSpeed = speed;
        this.isPaused = isPaused;
        this.autoWaveEnabled = autoWave;

        // Update Start Button Text & State
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            if (isGameRunning) {
                startBtn.textContent = '⚔️ WAVE IN PROGRESS...';
                startBtn.style.opacity = '0.65';
                startBtn.style.pointerEvents = 'none';
            } else {
                startBtn.textContent = `▶ START WAVE ${wave}`;
                startBtn.style.opacity = '1';
                startBtn.style.pointerEvents = 'auto';
            }
        }

        // Update speed button visual states
        document.querySelectorAll('.speed-btn').forEach(btn => {
            const spd = parseFloat(btn.dataset.speed);
            if (isPaused && btn.dataset.speed === '0') {
                btn.classList.add('active');
            } else if (!isPaused && spd === speed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update audio toggle icon
        const audioBtn = document.getElementById('audio-toggle-btn');
        if (audioBtn) {
            audioBtn.textContent = muted ? '🔇' : '🔊';
            audioBtn.title = muted ? 'Sound: Muted (Click to Unmute)' : 'Sound: Enabled (Click to Mute)';
        }

        // Update range toggle icon
        const rangeBtn = document.getElementById('range-toggle-btn');
        if (rangeBtn) {
            rangeBtn.classList.toggle('active', !!showRanges);
        }

        // Update auto-wave toggle
        const autoWaveBtn = document.getElementById('auto-wave-btn');
        if (autoWaveBtn) {
            autoWaveBtn.classList.toggle('active', !!autoWave);
        }
    }

    // --- Hotkey Cheat Sheet Modal ---
    openCheatSheetModal() {
        const modal = document.getElementById('cheat-sheet-modal');
        if (!modal) return;
        modal.style.display = 'flex';
    }

    closeCheatSheetModal() {
        const modal = document.getElementById('cheat-sheet-modal');
        if (modal) modal.style.display = 'none';
    }

    // --- Star Relic Shop Modal ---
    openRelicModal(metaManager) {
        const modal = document.getElementById('relic-modal');
        if (!modal) return;

        const starsCountEl = document.getElementById('relic-stars-display');
        if (starsCountEl) starsCountEl.textContent = metaManager.getStars();

        const container = document.getElementById('relic-list-container');
        if (container) {
            container.innerHTML = '';
            metaManager.relicsConfig.forEach(relic => {
                const rank = metaManager.getRelicRank(relic.id);
                const isMax = rank >= relic.maxRank;
                const cost = relic.costPerRank * (rank + 1);
                const canAfford = metaManager.getStars() >= cost && !isMax;

                const card = document.createElement('div');
                card.className = 'relic-card';
                card.innerHTML = `
                    <div class="relic-icon-wrapper">${relic.icon}</div>
                    <div class="relic-info">
                        <div class="relic-title-row">
                            <span class="relic-name">${relic.name}</span>
                            <span class="relic-rank-badge">Rank ${rank}/${relic.maxRank}</span>
                        </div>
                        <div class="relic-desc">${relic.desc}</div>
                    </div>
                    <button class="relic-buy-btn ${canAfford ? 'can-afford' : ''}" ${isMax ? 'disabled' : ''}>
                        ${isMax ? 'MAXED' : `⭐ ${cost}`}
                    </button>
                `;

                const btn = card.querySelector('.relic-buy-btn');
                if (btn && !isMax) {
                    btn.onclick = () => {
                        if (metaManager.upgradeRelic(relic.id)) {
                            this.showToast(`Upgraded ${relic.name}!`, '#10b981');
                            this.openRelicModal(metaManager);
                            if (this.callbacks.onRelicUpgraded) this.callbacks.onRelicUpgraded();
                        }
                    };
                }

                container.appendChild(card);
            });
        }

        modal.style.display = 'flex';
    }

    closeRelicModal() {
        const modal = document.getElementById('relic-modal');
        if (modal) modal.style.display = 'none';
    }

    // --- Map Selection Modal ---
    openMapModal(mapManager) {
        const modal = document.getElementById('map-modal');
        if (!modal) return;

        const container = document.getElementById('map-list-container');
        if (container) {
            container.innerHTML = '';
            mapManager.maps.forEach(map => {
                const isCurrent = mapManager.getCurrentMap().id === map.id;
                const card = document.createElement('div');
                card.className = `map-card ${isCurrent ? 'selected' : ''}`;
                card.innerHTML = `
                    <div class="map-icon-box">${map.icon || '🗺️'}</div>
                    <div class="map-info">
                        <div class="map-title-row">
                            <span class="map-name">${map.name}</span>
                            ${isCurrent ? '<span class="map-current-pill">ACTIVE</span>' : ''}
                        </div>
                        <div class="map-desc">${map.description}</div>
                    </div>
                    <button class="map-select-btn ${isCurrent ? 'active-map-btn' : ''}">
                        Start Game ⚔️
                    </button>
                `;

                const btn = card.querySelector('.map-select-btn');
                if (btn) {
                    btn.onclick = () => {
                        mapManager.setMap(map.id);
                        this.closeMapModal();
                        if (this.callbacks.onMapChanged) this.callbacks.onMapChanged(map);
                    };
                }

                container.appendChild(card);
            });
        }

        modal.style.display = 'flex';
    }

    closeMapModal() {
        const modal = document.getElementById('map-modal');
        if (modal) modal.style.display = 'none';
    }

    // --- Load Saved Games Modal ---
    openLoadModal(saveManager, game) {
        const modal = document.getElementById('load-modal');
        if (!modal) return;

        const container = document.getElementById('load-list-container');
        if (container) {
            const slots = saveManager.getSaveIndex();
            container.innerHTML = '';

            if (slots.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:24px 12px; color:var(--text-muted);">
                        No saved game slots found.<br>Use the <strong>💾 Save</strong> button during any prep phase to record a save point!
                    </div>
                `;
            } else {
                slots.forEach(slot => {
                    const card = document.createElement('div');
                    card.className = 'save-slot-card';
                    card.innerHTML = `
                        <div class="save-slot-info">
                            <div class="save-slot-title">
                                <strong>Wave ${slot.wave} • ${slot.mapName || 'Map'}</strong>
                            </div>
                            <div class="save-slot-meta">
                                <span>🪙 ${slot.gold}g</span> • <span>❤️ ${slot.lives} lives</span> • <span>🏰 ${(slot.towers || []).length} towers</span>
                            </div>
                            <div class="save-slot-date">${slot.dateStr}</div>
                        </div>
                        <div class="save-slot-actions">
                            <button class="save-btn-load">Load</button>
                            <button class="save-btn-del" title="Delete Save">✕</button>
                        </div>
                    `;

                    // Load click
                    card.querySelector('.save-btn-load').onclick = () => {
                        if (game.isGameRunning && !confirm('Loading will overwrite the current combat run. Proceed?')) return;
                        if (saveManager.applySave(slot, game)) {
                            this.showToast(`Loaded Wave ${slot.wave} Save!`, '#10b981');
                            this.closeLoadModal();
                        }
                    };

                    // Delete click
                    card.querySelector('.save-btn-del').onclick = () => {
                        if (confirm('Delete this saved game slot?')) {
                            saveManager.deleteSaveById(slot.id);
                            this.openLoadModal(saveManager, game);
                        }
                    };

                    container.appendChild(card);
                });
            }
        }

        modal.style.display = 'flex';
    }

    closeLoadModal() {
        const modal = document.getElementById('load-modal');
        if (modal) modal.style.display = 'none';
    }

    // --- End-Game Run Summary Modal ---
    openRunSummaryModal(summary, onPlayAgain) {
        const modal = document.getElementById('run-summary-modal');
        if (!modal) return;

        const content = document.getElementById('run-summary-content');
        if (content) {
            const mvpHtml = summary.mvp ? `
                <div class="summary-mvp-card">
                    <div class="mvp-badge">🏆 MVP TOWER OF THE RUN</div>
                    <div class="mvp-tower-title">${summary.mvp.name} (Lvl ${summary.mvp.level}${summary.mvp.spec ? ` • ${summary.mvp.spec}` : ''})</div>
                    <div class="mvp-stats-row">
                        <span>💥 Damage: <strong>${summary.mvp.damage.toLocaleString()}</strong></span>
                        <span>💀 Kills: <strong>${summary.mvp.kills}</strong></span>
                    </div>
                </div>
            ` : '';

            content.innerHTML = `
                <div class="summary-stat-grid">
                    <div class="summary-stat-box">
                        <div class="s-label">Wave Cleared</div>
                        <div class="s-val text-cyan">W${summary.wave}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="s-label">Enemies Slain</div>
                        <div class="s-val text-purple">${summary.kills}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="s-label">Total Damage</div>
                        <div class="s-val text-rose">${summary.damage.toLocaleString()}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="s-label">Gold Earned</div>
                        <div class="s-val text-amber">🪙 ${summary.gold}</div>
                    </div>
                </div>
                ${mvpHtml}
                <div class="summary-element-breakdown">
                    <div class="s-subhead">Damage By Element</div>
                    <div class="element-bar-row">
                        <span>🔥 Fire: ${Math.round(summary.damageByElement.fire || 0)}</span>
                        <span>🌊 Water: ${Math.round(summary.damageByElement.water || 0)}</span>
                        <span>🌲 Earth: ${Math.round(summary.damageByElement.earth || 0)}</span>
                        <span>⚔️ Physical: ${Math.round(summary.damageByElement.physical || 0)}</span>
                    </div>
                </div>
            `;
        }

        const againBtn = document.getElementById('summary-restart-btn');
        if (againBtn) {
            againBtn.onclick = () => {
                modal.style.display = 'none';
                if (onPlayAgain) onPlayAgain();
            };
        }

        modal.style.display = 'flex';
    }

    closeRunSummaryModal() {
        const modal = document.getElementById('run-summary-modal');
        if (modal) modal.style.display = 'none';
    }
}
