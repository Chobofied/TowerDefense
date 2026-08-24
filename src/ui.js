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

    // --- Star Market Modal ---
    openRelicModal(metaManager, gameInstance = null) {
        const modal = document.getElementById('relic-modal');
        if (!modal) return;

        const starCount = metaManager.getStars();
        const starsCountEl = document.getElementById('relic-stars-display');
        if (starsCountEl) starsCountEl.textContent = starCount;

        const container = document.getElementById('relic-list-container');
        if (container) {
            container.innerHTML = '';

            const wave = gameInstance ? (gameInstance.wave || 1) : 1;
            const goldForStar = 50 + (5 * wave);
            const canAfford = starCount >= 1;

            const marketWrapper = document.createElement('div');
            marketWrapper.style.cssText = 'display:flex; flex-direction:column; gap:12px; padding:4px 0;';

            // Item 1: Buy +1 Life
            const lifeCard = document.createElement('div');
            lifeCard.className = 'relic-card';
            lifeCard.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.85); border:1px solid rgba(239,68,68,0.3); border-radius:10px; padding:14px;';
            lifeCard.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="font-size:2em; background:rgba(239,68,68,0.15); width:50px; height:50px; border-radius:10px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(239,68,68,0.4);">
                        ❤️
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:1.05em; color:#fff;">+1 Defense Life</div>
                        <div style="font-size:0.82em; color:var(--text-secondary); margin-top:2px;">Instantly adds +1 Life to your core defense.</div>
                    </div>
                </div>
                <button class="relic-buy-btn ${canAfford ? 'can-afford' : ''}" style="background:${canAfford ? '#ef4444' : '#475569'}; color:#fff; font-weight:800; padding:10px 18px; border-radius:8px; border:none; cursor:${canAfford ? 'pointer' : 'not-allowed'}; min-width:95px;" ${!canAfford ? 'disabled' : ''}>
                    ⭐ 1 Star
                </button>
            `;

            const lifeBtn = lifeCard.querySelector('button');
            if (lifeBtn && canAfford && gameInstance) {
                lifeBtn.onclick = () => {
                    if (metaManager.getStars() >= 1) {
                        metaManager.addStar(-1);
                        gameInstance.lives++;
                        this.showToast(`+1 Life Purchased! (❤️ ${gameInstance.lives})`, '#ef4444');
                        gameInstance.updateUI();
                        this.openRelicModal(metaManager, gameInstance);
                    }
                };
            }
            marketWrapper.appendChild(lifeCard);

            // Item 2: Buy Gold (50 + 5 * wave)
            const goldCard = document.createElement('div');
            goldCard.className = 'relic-card';
            goldCard.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.85); border:1px solid rgba(234,179,8,0.3); border-radius:10px; padding:14px;';
            goldCard.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="font-size:2em; background:rgba(234,179,8,0.15); width:50px; height:50px; border-radius:10px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(234,179,8,0.4);">
                        🪙
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:1.05em; color:#fff;">+${goldForStar}g Gold Supply</div>
                        <div style="font-size:0.82em; color:var(--text-secondary); margin-top:2px;">Instant gold injection (Formula: 50 + 5 × Wave ${wave}).</div>
                    </div>
                </div>
                <button class="relic-buy-btn ${canAfford ? 'can-afford' : ''}" style="background:${canAfford ? '#eab308' : '#475569'}; color:${canAfford ? '#0f172a' : '#fff'}; font-weight:800; padding:10px 18px; border-radius:8px; border:none; cursor:${canAfford ? 'pointer' : 'not-allowed'}; min-width:95px;" ${!canAfford ? 'disabled' : ''}>
                    ⭐ 1 Star
                </button>
            `;

            const goldBtn = goldCard.querySelector('button');
            if (goldBtn && canAfford && gameInstance) {
                goldBtn.onclick = () => {
                    if (metaManager.getStars() >= 1) {
                        metaManager.addStar(-1);
                        gameInstance.gold += goldForStar;
                        this.showToast(`+${goldForStar}g Gold Purchased!`, '#facc15');
                        gameInstance.updateUI();
                        this.openRelicModal(metaManager, gameInstance);
                    }
                };
            }
            marketWrapper.appendChild(goldCard);

            container.appendChild(marketWrapper);
        }

        modal.style.display = 'flex';
    }

    closeRelicModal() {
        const modal = document.getElementById('relic-modal');
        if (modal) modal.style.display = 'none';
    }

    // --- Map & Difficulty Selection Modal ---
    openMapModal(mapManager, metaManager = null, difficultiesConfig = []) {
        const modal = document.getElementById('map-modal');
        if (!modal) return;

        const container = document.getElementById('map-list-container');
        if (container) {
            container.innerHTML = '';

            // 1. Difficulty Tier Selection Header
            if (metaManager && difficultiesConfig && difficultiesConfig.length > 0) {
                const curDiff = metaManager.getDifficulty();
                const diffSection = document.createElement('div');
                diffSection.style.marginBottom = '14px';

                let diffCardsHtml = '';
                difficultiesConfig.forEach(d => {
                    const isUnlocked = metaManager.isDifficultyUnlocked(d.id);
                    const isSelected = curDiff === d.id;
                    diffCardsHtml += `
                        <div class="diff-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}" data-diff="${d.id}">
                            ${!isUnlocked ? '<div class="diff-card-lock-badge">🔒 LOCKED</div>' : ''}
                            <div class="diff-card-icon">${d.icon || '⚔️'}</div>
                            <div class="diff-card-name">${d.name}</div>
                            <div class="diff-card-waves">100 Waves</div>
                            <div style="font-size:0.68em; color:var(--text-secondary); margin-top:2px;">
                                ${d.hpMult > 1 ? `HP: x${d.hpMult}` : 'Standard'}
                            </div>
                        </div>
                    `;
                });

                diffSection.innerHTML = `
                    <div style="font-size:0.75em; font-weight:800; color:var(--text-secondary); text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">
                        Select Campaign Difficulty
                    </div>
                    <div class="diff-selector-container">
                        ${diffCardsHtml}
                    </div>
                    <div style="font-size:0.75em; font-weight:800; color:var(--text-secondary); text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">
                        Select Battlefield Map
                    </div>
                `;

                // Difficulty click handlers
                diffSection.querySelectorAll('.diff-card').forEach(card => {
                    card.onclick = () => {
                        const diffId = parseInt(card.dataset.diff, 10);
                        if (metaManager.isDifficultyUnlocked(diffId)) {
                            metaManager.setDifficulty(diffId);
                            this.showToast(`Selected Difficulty: ${card.querySelector('.diff-card-name').textContent}`, '#10b981', 1200);
                            this.openMapModal(mapManager, metaManager, difficultiesConfig);
                        } else {
                            this.showToast(`Locked! Beat 100 Waves on previous difficulty to unlock.`, '#f43f5e', 2500);
                        }
                    };
                });

                container.appendChild(diffSection);
            }

            // 2. Map Cards
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

    // --- Campaign Victory & Endless Mode Modal ---
    openVictoryModal({ difficulty, difficultyName, nextDiffUnlocked, onContinueEndless, onFinishMission }) {
        const modal = document.getElementById('victory-modal');
        if (!modal) return;

        const content = document.getElementById('victory-modal-content');
        if (content) {
            content.innerHTML = `
                <div style="font-size:1.1em; font-weight:800; color:#fff; margin-bottom:8px;">
                    🎉 Congratulations Commander!
                </div>
                <div style="font-size:0.85em; color:var(--text-secondary); line-height:1.5;">
                    You have successfully defended all <strong>100 Waves</strong> on <strong>${difficultyName}</strong> difficulty!
                </div>
                ${nextDiffUnlocked ? `
                    <div style="background:rgba(250,204,21,0.15); border:1px solid #facc15; border-radius:8px; padding:10px; margin:14px 0 6px;">
                        <div style="color:#facc15; font-weight:800; font-size:0.9em;">⭐ REWARD: +5 STAR TOKENS!</div>
                        <div style="font-size:0.75em; color:#fef08a; margin-top:2px;">Next difficulty tier is now unlocked in the Campaign selector!</div>
                    </div>
                ` : ''}
                <div style="font-size:0.78em; color:var(--text-muted); margin-top:10px;">
                    Would you like to continue pushing into <strong>Endless Mode (Waves 101+)</strong> for supreme high scores, or conclude this operation?
                </div>
            `;
        }

        const endlessBtn = document.getElementById('victory-endless-btn');
        if (endlessBtn) {
            endlessBtn.onclick = () => {
                this.closeVictoryModal();
                if (onContinueEndless) onContinueEndless();
            };
        }

        const finishBtn = document.getElementById('victory-finish-btn');
        if (finishBtn) {
            finishBtn.onclick = () => {
                this.closeVictoryModal();
                if (onFinishMission) onFinishMission();
            };
        }

        modal.style.display = 'flex';
    }

    closeVictoryModal() {
        const modal = document.getElementById('victory-modal');
        if (modal) modal.style.display = 'none';
    }

    // --- Load Saved Games Modal ---
    openLoadModal(saveManager, game) {
        const modal = document.getElementById('load-modal');
        if (!modal) return;

        this.saveSortOption = this.saveSortOption || 'date-desc';

        const container = document.getElementById('load-list-container');
        if (container) {
            let slots = saveManager.getSaveIndex();
            container.innerHTML = '';

            if (slots.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:24px 12px; color:var(--text-muted);">
                        No saved game slots found.<br>Use the <strong>💾 Save</strong> button during any prep phase to record a save point!
                    </div>
                `;
            } else {
                // Top Sorting Control Bar
                const sortBar = document.createElement('div');
                sortBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:7px 12px; background:rgba(15,23,42,0.7); border:1px solid var(--border-subtle); border-radius:var(--radius-md);';
                sortBar.innerHTML = `
                    <span style="font-size:0.82em; font-weight:800; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">
                        Sort Saves:
                    </span>
                    <select id="save-sort-select" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; border-radius:6px; padding:4px 10px; font-size:0.82em; font-weight:700; cursor:pointer;">
                        <option value="date-desc" ${this.saveSortOption === 'date-desc' ? 'selected' : ''}>📅 Date: Newest First</option>
                        <option value="date-asc" ${this.saveSortOption === 'date-asc' ? 'selected' : ''}>📅 Date: Oldest First</option>
                        <option value="wave-desc" ${this.saveSortOption === 'wave-desc' ? 'selected' : ''}>🌊 Wave: Highest First</option>
                        <option value="wave-asc" ${this.saveSortOption === 'wave-asc' ? 'selected' : ''}>🌊 Wave: Lowest First</option>
                    </select>
                `;

                const sortSelect = sortBar.querySelector('#save-sort-select');
                if (sortSelect) {
                    sortSelect.onchange = (e) => {
                        this.saveSortOption = e.target.value;
                        this.openLoadModal(saveManager, game);
                    };
                }
                container.appendChild(sortBar);

                // Sort Slots
                if (this.saveSortOption === 'date-asc') {
                    slots.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                } else if (this.saveSortOption === 'wave-desc') {
                    slots.sort((a, b) => (b.wave || 0) - (a.wave || 0));
                } else if (this.saveSortOption === 'wave-asc') {
                    slots.sort((a, b) => (a.wave || 0) - (b.wave || 0));
                } else {
                    // Default 'date-desc'
                    slots.sort((a, b) => (b.ts || 0) - (a.ts || 0));
                }

                // Render Slot Cards
                slots.forEach(slot => {
                    const card = document.createElement('div');
                    card.className = 'save-slot-card';
                    card.innerHTML = `
                        <div class="save-slot-info">
                            <div class="save-slot-title">
                                <strong>Wave ${slot.wave} • ${slot.mapName || 'Map'}</strong>
                            </div>
                            <div class="save-slot-meta">
                                <span>🪙 ${slot.gold}g</span> • <span>❤️ ${slot.lives} lives</span> • <span>⭐ ${slot.stars || 0} stars</span> • <span>🏰 ${(slot.towers || []).length} towers</span>
                            </div>
                            <div class="save-desc-section" style="margin-top:4px; font-size:0.82em;">
                                <div class="save-desc-display" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <span class="save-desc-text" style="color:${slot.description ? '#cbd5e1' : '#64748b'}; font-style:italic; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">
                                        ${slot.description ? `📝 "${slot.description}"` : '✏️ Add description...'}
                                    </span>
                                    <button class="save-desc-edit-btn" title="Edit Description" style="background:transparent; border:none; color:#38bdf8; cursor:pointer; font-size:0.85em; padding:0 2px;">✏️</button>
                                </div>
                                <div class="save-desc-form" style="display:none; align-items:center; gap:4px; margin-top:3px;">
                                    <input type="text" class="save-desc-input" value="${slot.description || ''}" placeholder="Enter save note..." maxlength="60" style="flex:1; background:#0f172a; border:1px solid #38bdf8; border-radius:4px; color:#fff; padding:3px 6px; font-size:0.82em;">
                                    <button class="save-desc-save-btn" style="background:#10b981; color:#fff; border:none; border-radius:4px; padding:3px 8px; font-size:0.78em; font-weight:800; cursor:pointer;">Save</button>
                                    <button class="save-desc-cancel-btn" style="background:#64748b; color:#fff; border:none; border-radius:4px; padding:3px 6px; font-size:0.78em; cursor:pointer;">✕</button>
                                </div>
                            </div>
                            <div class="save-slot-date" style="font-size:0.72em; color:var(--text-muted); margin-top:4px;">${slot.dateStr}</div>
                        </div>
                        <div class="save-slot-actions">
                            <button class="save-btn-load">Load</button>
                            <button class="save-btn-del" title="Delete Save">✕</button>
                        </div>
                    `;

                    // Description Inline Edit Handlers
                    const descDisplay = card.querySelector('.save-desc-display');
                    const descForm = card.querySelector('.save-desc-form');
                    const descInput = card.querySelector('.save-desc-input');
                    const descSaveBtn = card.querySelector('.save-desc-save-btn');
                    const descCancelBtn = card.querySelector('.save-desc-cancel-btn');

                    const startEditing = () => {
                        descDisplay.style.display = 'none';
                        descForm.style.display = 'flex';
                        descInput.focus();
                        descInput.select();
                    };

                    const cancelEditing = () => {
                        descForm.style.display = 'none';
                        descDisplay.style.display = 'flex';
                    };

                    const saveDescription = () => {
                        const newDesc = descInput.value.trim();
                        saveManager.updateDescription(slot.id, newDesc);
                        this.showToast('Save description updated!', '#10b981', 1200);
                        this.openLoadModal(saveManager, game);
                    };

                    if (descDisplay) descDisplay.onclick = (e) => { e.stopPropagation(); startEditing(); };
                    if (descCancelBtn) descCancelBtn.onclick = (e) => { e.stopPropagation(); cancelEditing(); };
                    if (descSaveBtn) descSaveBtn.onclick = (e) => { e.stopPropagation(); saveDescription(); };
                    if (descInput) {
                        descInput.onclick = (e) => e.stopPropagation();
                        descInput.onkeydown = (e) => {
                            if (e.key === 'Enter') saveDescription();
                            if (e.key === 'Escape') cancelEditing();
                        };
                    }

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
