// src/enemies.js - Enemy Entity, Movement Physics, Status Effects, Traits & Boss Phases

export class EnemyManager {
    constructor(tileSize = 48, statusConfig = {}) {
        this.tileSize = tileSize;
        this.statusConfig = statusConfig;
        this.enemies = [];
        this.enemyTextures = {};
    }

    setTextures(textures) {
        this.enemyTextures = textures;
    }

    createEnemy(config, startPos, endPos, path, waveNum = 1) {
        const isBoss = config.name === 'Boss' || !!config.isBoss;
        const isFlying = !!config.flying;
        const hp = config.hp || config.baseHp || 45;
        const speed = config.speed || config.baseSpeed || 1.0;

        const enemy = {
            id: 'e_' + Math.random().toString(36).substr(2, 9),
            type: config,
            wave: waveNum || 1,
            x: startPos.x * this.tileSize + this.tileSize / 2,
            y: startPos.y * this.tileSize + this.tileSize / 2,
            hp: hp,
            maxHp: hp,
            chipHp: hp, // For trailing white damage health bar
            speed: speed,
            baseSpeed: speed,
            flying: isFlying,
            alive: true,
            path: path,
            pathIdx: 0,
            endPos: endPos,
            facing: 1,
            tilt: 0,
            bobY: 0,
            scaleXMod: 1,
            scaleYMod: 1,
            hitFlash: 0,
            walkPhase: Math.random() * Math.PI * 2,
            hoverPhase: Math.random() * Math.PI * 2,

            // Status Effects Map: { [type]: { duration, timer, data } }
            statuses: {},

            // Traits
            trait: config.trait || null,
            shieldHits: config.shieldHits || 0,
            maxShieldHits: config.shieldHits || 0,
            healCooldown: config.healCooldown || 2.5,
            healTimer: 0,

            // Boss Phases & Combat
            isBoss,
            bossAbilities: config.abilities || null,
            enraged: false,
            minionsSummoned: false,
            empTimer: 0,
            bossTowerAttackTimer: isBoss ? 2.5 : 0,

            // Momentum & Path Acceleration Physics
            momentum: 1.0,
            straightRun: 0,

            _sprite: null,
            _emojiText: null
        };

        return enemy;
    }

    applyStatus(enemy, statusType, duration = null, extraData = {}) {
        if (!enemy || !enemy.alive) return;
        const config = this.statusConfig[statusType] || {};
        const dur = duration || config.duration || 3.0;

        // If enemy is Soaked, extend slow duration and amplify
        let finalDur = dur;
        if (statusType === 'slow' && enemy.statuses['soaked']) {
            finalDur *= 1.4;
        }

        enemy.statuses[statusType] = {
            duration: finalDur,
            maxDuration: finalDur,
            tickTimer: 0,
            ...config,
            ...extraData
        };
    }

    removeStatus(enemy, statusType) {
        if (enemy.statuses[statusType]) {
            delete enemy.statuses[statusType];
        }
    }

    hasStatus(enemy, statusType) {
        return !!enemy.statuses[statusType];
    }

    // --- Update Enemies ---
    update(delta, pathfinding, effects, audio, meta, onEnemyReachExit, onEnemyKilled, onSpawnMinions, onEmpDisrupt, towersManager = null, difficultyConfig = null, onBossAttackTower = null) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.alive || isNaN(e.x) || isNaN(e.y) || isNaN(e.hp)) {
                if (e._sprite) e._sprite.visible = false;
                if (e._emojiText) e._emojiText.visible = false;
                this.enemies.splice(i, 1);
                continue;
            }

            // --- Status Effects Ticking ---
            let speedModifier = 1.0;
            let isStunned = false;

            for (const [sType, sData] of Object.entries(e.statuses)) {
                sData.duration -= delta / 60;

                if (sType === 'slow') {
                    speedModifier *= (1 - (sData.slowAmount || 0.4));
                } else if (sType === 'stun') {
                    isStunned = true;
                } else if (sType === 'burn') {
                    sData.tickTimer += delta / 60;
                    if (sData.tickTimer >= (sData.tickInterval || 0.8)) {
                        sData.tickTimer = 0;
                        const burnDmg = Math.max(2, e.maxHp * (sData.damagePercentMaxHp || 0.025));
                        e.hp -= burnDmg;
                        effects.addDamageNumber(e.x, e.y - 15, burnDmg, false, 'burn');
                        meta.recordDamage(burnDmg, 'fire');
                    }
                } else if (sType === 'bleed') {
                    sData.tickTimer += delta / 60;
                    if (sData.tickTimer >= (sData.tickInterval || 0.6)) {
                        sData.tickTimer = 0;
                        const bleedDmg = sData.damagePerTick || 6;
                        e.hp -= bleedDmg;
                        effects.addDamageNumber(e.x, e.y - 15, bleedDmg, false, 'bleed');
                        meta.recordDamage(bleedDmg, 'physical');
                    }
                }

                if (sData.duration <= 0) {
                    delete e.statuses[sType];
                }
            }

            // Trailing damage health bar chip decay
            if (e.chipHp > e.hp) {
                e.chipHp = Math.max(e.hp, e.chipHp - (e.maxHp * 0.015 * delta));
            } else {
                e.chipHp = e.hp;
            }

            // Hit Flash decay
            if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - delta);

            // Check Death from DoT
            if (e.hp <= 0) {
                e.alive = false;
                effects.triggerDeathEffect(e);
                audio.playHit(false);
                meta.recordKill(e.type.reward);
                onEnemyKilled(e);
                continue;
            }

            // --- Trait: Healer Pulse ---
            if (e.trait === 'healer' && !isStunned) {
                e.healTimer += delta / 60;
                if (e.healTimer >= e.healCooldown) {
                    e.healTimer = 0;
                    const r = e.type.healRadius || 110;
                    for (const other of this.enemies) {
                        if (other !== e && other.alive && Math.hypot(other.x - e.x, other.y - e.y) <= r) {
                            if (other.hp < other.maxHp) {
                                const healAmt = other.maxHp * (e.type.healPercent || 0.12);
                                other.hp = Math.min(other.maxHp, other.hp + healAmt);
                                effects.addDamageNumber(other.x, other.y - 18, healAmt, false, 'weakness');
                            }
                        }
                    }
                }
            }

            // --- Boss Mechanics & Tower Attacks ---
            if (e.isBoss && !isStunned) {
                const hpRatio = e.hp / e.maxHp;

                // 1. Enrage sprint at < 30% HP
                if (e.bossAbilities && !e.enraged && hpRatio <= (e.bossAbilities.enrageHpThreshold || 0.3)) {
                    e.enraged = true;
                    effects.triggerShake(8, 20);
                    audio.playBossAlarm();
                }

                // 2. Summon Minions at 50% HP
                if (e.bossAbilities && !e.minionsSummoned && hpRatio <= (e.bossAbilities.summonMinionsHpThreshold || 0.5)) {
                    e.minionsSummoned = true;
                    onSpawnMinions(e.x, e.y);
                    audio.playBossAlarm();
                }

                // 3. EMP Shockwave Pulse
                if (e.bossAbilities) {
                    e.empTimer += delta / 60;
                    if (e.empTimer >= (e.bossAbilities.empCooldown || 10)) {
                        e.empTimer = 0;
                        const empRadius = e.bossAbilities.empRadius || 130;
                        effects.addEmpShockwave(e.x, e.y, empRadius, 30);
                        audio.playEmp();
                        onEmpDisrupt(e.x, e.y, empRadius, e.bossAbilities.empDuration || 2.5);
                    }
                }

                // 4. Boss 15-Second Enrage 'Mega Attack' (Obliterates all towers in 1-block radius)
                e.bossAliveTimer = (e.bossAliveTimer || 0) + (delta / 60);
                if (e.bossAliveTimer >= 15.0 && !e.megaAttackFired) {
                    e.megaAttackFired = true;
                    const bossTx = Math.floor(e.x / this.tileSize);
                    const bossTy = Math.floor(e.y / this.tileSize);

                    if (towersManager && towersManager.towers) {
                        const activeTowers = towersManager.towers.filter(t => !t.isDestroyed);
                        const megaTargets = activeTowers.filter(t =>
                            Math.abs(t.x - bossTx) <= 1 && Math.abs(t.y - bossTy) <= 1
                        );

                        for (const target of megaTargets) {
                            const tcx = target.x * this.tileSize + this.tileSize / 2;
                            const tcy = target.y * this.tileSize + this.tileSize / 2;
                            towersManager.damageTower(target, 999999);
                            effects.addDamageNumber(tcx, tcy - 16, '💥 OBLITERATED!', true, 'fire');
                            if (onBossAttackTower) onBossAttackTower(target, 999999);
                        }
                    }

                    // Screen-shaking Crimson Nova shockwave
                    effects.addDamageNumber(e.x, e.y - 32, '⚠️ MEGA ATTACK! 💥', true, 'fire');
                    effects.splashEffects.push({
                        x: e.x, y: e.y,
                        radius: 0,
                        maxRadius: this.tileSize * 2.5,
                        color: 0xff0055,
                        alpha: 1,
                        duration: 45
                    });
                    effects.triggerShake(14, 35);
                    audio.playBossAlarm();
                }

                // 5. Boss Attacks on Towers (Frequent Omnidirectional 360° Ground Shockwave + Artillery Mortars)
                if (towersManager && towersManager.towers && towersManager.towers.length > 0) {
                    e.bossTowerAttackTimer = (e.bossTowerAttackTimer || 0) + (delta / 60);
                    const waveNum = e.wave || 1;
                    const waveProgressionMult = 1 + (waveNum - 1) * 0.025;
                    const baseInterval = (difficultyConfig && difficultyConfig.bossAttackInterval) || 2.2;
                    const enrageSpeedMult = e.enraged ? 0.65 : 1.0;
                    const attackInterval = Math.max(0.85, (baseInterval * enrageSpeedMult) / Math.sqrt(waveProgressionMult));
                    const baseDamage = (difficultyConfig && difficultyConfig.bossAttackDamage) || 55;
                    const scaledDamage = baseDamage * waveProgressionMult;
                    // Random variance (+/- 30%)
                    const randomFactor = 0.70 + Math.random() * 0.60;
                    const attackDamage = Math.max(10, Math.round(scaledDamage * randomFactor));

                    if (e.bossTowerAttackTimer >= attackInterval) {
                        const activeTowers = towersManager.towers.filter(t => !t.isDestroyed);
                        if (activeTowers.length > 0) {
                            // 360° Omnidirectional Check: All towers around the Boss within 130px (covers top, bottom, left, right, diagonals)
                            const omniRadius = 130;
                            const nearbyTowersAllAround = [];
                            let nearestTower = null;
                            let minDistance = Infinity;

                            for (const t of activeTowers) {
                                const tcx = t.x * this.tileSize + this.tileSize / 2;
                                const tcy = t.y * this.tileSize + this.tileSize / 2;
                                const dist = Math.hypot(tcx - e.x, tcy - e.y);
                                if (dist <= omniRadius) {
                                    nearbyTowersAllAround.push(t);
                                }
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    nearestTower = t;
                                }
                            }

                            // If there are towers around the Boss, slam ALL of them in 360 degrees!
                            if (nearbyTowersAllAround.length > 0) {
                                e.bossTowerAttackTimer = 0;
                                for (const hitTower of nearbyTowersAllAround) {
                                    const tcx = hitTower.x * this.tileSize + this.tileSize / 2;
                                    const tcy = hitTower.y * this.tileSize + this.tileSize / 2;
                                    towersManager.damageTower(hitTower, attackDamage);
                                    effects.addDamageNumber(tcx, tcy - 16, `-${attackDamage} HP 💥`, false, 'fire');
                                    if (onBossAttackTower) onBossAttackTower(hitTower, attackDamage);
                                }

                                // 360° Omnidirectional Fiery Shockwave centered directly on Boss
                                effects.splashEffects.push({
                                    x: e.x, y: e.y,
                                    radius: 0,
                                    maxRadius: omniRadius,
                                    color: 0xf43f5e,
                                    alpha: 1,
                                    duration: 25
                                });
                                audio.playHit(true);
                                effects.triggerShake(7, 18);
                            } else if (nearestTower && minDistance <= 240) {
                                // Range mortar attack if no towers are directly adjacent
                                e.bossTowerAttackTimer = 0;
                                const targetTx = nearestTower.x;
                                const targetTy = nearestTower.y;
                                const targetCx = targetTx * this.tileSize + this.tileSize / 2;
                                const targetCy = targetTy * this.tileSize + this.tileSize / 2;

                                const splashTiles = 1;
                                const splashTowers = activeTowers.filter(t =>
                                    Math.abs(t.x - targetTx) <= splashTiles && Math.abs(t.y - targetTy) <= splashTiles
                                );

                                for (const hitTower of splashTowers) {
                                    const tcx = hitTower.x * this.tileSize + this.tileSize / 2;
                                    const tcy = hitTower.y * this.tileSize + this.tileSize / 2;
                                    const dmg = (hitTower === nearestTower) ? attackDamage : Math.round(attackDamage * 0.85);

                                    towersManager.damageTower(hitTower, dmg);
                                    effects.addDamageNumber(tcx, tcy - 16, `-${dmg} HP 💥`, false, 'fire');
                                    if (onBossAttackTower) onBossAttackTower(hitTower, dmg);
                                }

                                effects.splashEffects.push({
                                    x: targetCx, y: targetCy,
                                    radius: 0,
                                    maxRadius: (splashTiles + 0.5) * this.tileSize,
                                    color: 0xf43f5e,
                                    alpha: 1,
                                    duration: 25
                                });
                                audio.playHit(true);
                                effects.triggerShake(5, 14);
                            }
                        }
                    }
                }
            }

            // If stunned, skip movement
            if (isStunned) continue;

            // Compute Final Speed
            let currentSpeed = e.baseSpeed * speedModifier;
            if (e.enraged) currentSpeed *= (e.bossAbilities.enrageSpeedMult || 1.35);

            // --- Movement ---
            if (e.flying) {
                const tx = e.endPos.x * this.tileSize + this.tileSize / 2;
                const ty = e.endPos.y * this.tileSize + this.tileSize / 2;
                const dx = tx - e.x;
                const dy = ty - e.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 8) {
                    e.alive = false;
                    onEnemyReachExit(e);
                    continue;
                }

                const spd = currentSpeed * delta * 2.2;
                e.x += (dx / dist) * spd;
                e.y += (dy / dist) * spd;

                if (Math.abs(dx) > 0.3) e.facing = dx > 0 ? 1 : -1;

                e.hoverPhase += delta * 0.08;
                e.bobY = Math.sin(e.hoverPhase) * 4.5;
                e.tilt = (dx / dist) * 0.16;
                const wingbeat = Math.sin(e.hoverPhase * 2.4);
                e.scaleXMod = 1 + wingbeat * 0.05;
                e.scaleYMod = 1 - wingbeat * 0.04;
            } else {
                // Ground Movement along Path
                if (!e.path || e.pathIdx >= e.path.length) {
                    const egx = Math.max(0, Math.min(13, Math.round((e.x - this.tileSize / 2) / this.tileSize)));
                    const egy = Math.max(0, Math.min(13, Math.round((e.y - this.tileSize / 2) / this.tileSize)));
                    if (egx === e.endPos.x && egy === e.endPos.y) {
                        e.alive = false;
                        onEnemyReachExit(e);
                        continue;
                    } else if (pathfinding) {
                        const newPath = pathfinding.findPath({ x: egx, y: egy }, e.endPos);
                        if (newPath && newPath.length > 1) {
                            e.path = newPath;
                            e.pathIdx = 1;
                        } else {
                            // Direct glide towards exit
                            const tx = e.endPos.x * this.tileSize + this.tileSize / 2;
                            const ty = e.endPos.y * this.tileSize + this.tileSize / 2;
                            const dx = tx - e.x;
                            const dy = ty - e.y;
                            const dist = Math.hypot(dx, dy);
                            if (dist < 8) {
                                e.alive = false;
                                onEnemyReachExit(e);
                                continue;
                            }
                            const spd = currentSpeed * delta * 2.2;
                            e.x += (dx / dist) * spd;
                            e.y += (dy / dist) * spd;
                            continue;
                        }
                    } else {
                        e.alive = false;
                        onEnemyReachExit(e);
                        continue;
                    }
                }

                const node = e.path[e.pathIdx];
                const tx = node.x * this.tileSize + this.tileSize / 2;
                const ty = node.y * this.tileSize + this.tileSize / 2;
                const dx = tx - e.x;
                const dy = ty - e.y;
                const dist = Math.hypot(dx, dy);

                // --- Straightaway Acceleration vs Corner Braking Physics ---
                if (e.path && e.pathIdx < e.path.length) {
                    const currNode = e.path[e.pathIdx];
                    const prevNode = e.path[Math.max(0, e.pathIdx - 1)] || { x: Math.round((e.x - this.tileSize / 2) / this.tileSize), y: Math.round((e.y - this.tileSize / 2) / this.tileSize) };
                    const nextNode = e.path[e.pathIdx + 1];

                    const curDirX = currNode.x - prevNode.x;
                    const curDirY = currNode.y - prevNode.y;

                    if (nextNode) {
                        const nextDirX = nextNode.x - currNode.x;
                        const nextDirY = nextNode.y - currNode.y;
                        const isStraight = (curDirX === nextDirX && curDirY === nextDirY);

                        if (isStraight) {
                            // Accelerate smoothly along straightaway up to 1.45x sprint speed
                            e.momentum = Math.min(1.45, (e.momentum || 1.0) + (delta * 0.012));
                            e.straightRun = (e.straightRun || 0) + 1;
                        } else {
                            // Approaching corner turn: decelerate into the bend down to 0.70x
                            const distToTurn = dist;
                            if (distToTurn < this.tileSize * 0.85) {
                                e.momentum = Math.max(0.70, (e.momentum || 1.0) - (delta * 0.035));
                            }
                            e.straightRun = 0;
                        }
                    } else {
                        // Near final exit
                        e.momentum = Math.min(1.3, (e.momentum || 1.0) + (delta * 0.01));
                    }
                }

                const effectiveSpeed = currentSpeed * (e.momentum || 1.0);
                const spd = effectiveSpeed * delta * 2.2;

                let moveDist = 0;
                if (dist < spd) {
                    moveDist = dist;
                    e.x = tx;
                    e.y = ty;
                    e.pathIdx++;
                } else {
                    moveDist = spd;
                    e.x += (dx / dist) * spd;
                    e.y += (dy / dist) * spd;
                }

                if (Math.abs(dx) > 0.4) e.facing = dx > 0 ? 1 : -1;

                const walkCadence = e.isBoss ? 2.8 : 4.0;
                const prevPhase = e.walkPhase;
                e.walkPhase = prevPhase + (moveDist / this.tileSize) * Math.PI * walkCadence;

                const bobH = e.isBoss ? 5.5 : 3.6;
                e.bobY = Math.abs(Math.sin(e.walkPhase)) * bobH;

                const maxTilt = e.isBoss ? 0.07 : 0.13;
                e.tilt = Math.sin(e.walkPhase) * maxTilt * (e.facing || 1);

                const stepImpact = 1 - Math.abs(Math.sin(e.walkPhase));
                const squash = e.isBoss ? 0.13 : 0.08;
                e.scaleYMod = 1 - (stepImpact * squash) + ((1 - stepImpact) * squash * 0.4);
                e.scaleXMod = 1 + (stepImpact * squash * 0.8) - ((1 - stepImpact) * squash * 0.3);

                // Footstep Dust Callback
                const currSin = Math.sin(e.walkPhase);
                const prevSin = Math.sin(prevPhase);
                if ((prevSin < 0 && currSin >= 0) || (prevSin > 0 && currSin <= 0)) {
                    if (effects && effects.dustParticles) {
                        effects.dustParticles.push({
                            x: e.x + (e.facing > 0 ? -5 : 5),
                            y: e.y + (e.isBoss ? this.tileSize * 0.42 : this.tileSize * 0.34),
                            vx: (Math.random() - 0.5) * 0.7 - (dx / (dist || 1)) * 0.3,
                            vy: -0.35 - Math.random() * 0.35,
                            radius: e.isBoss ? 3.6 + Math.random() * 2 : 2.2 + Math.random() * 1.4,
                            duration: e.isBoss ? 20 : 14,
                            maxDuration: e.isBoss ? 20 : 14,
                            color: 0xa0aec0
                        });
                    }
                }
            }
        }
    }

    // --- Draw Enemies, Shadows, Health Bars & Auras ---
    draw(graphics, stage, selectedEnemy) {
        const nowTime = Date.now();

        // 1. Shadows
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const isBoss = e.isBoss;
            const isFlying = e.flying;
            const baseW = isBoss ? this.tileSize * 0.75 : (isFlying ? this.tileSize * 0.46 : this.tileSize * 0.52);
            const baseH = baseW * 0.42;
            const sy = e.y + (isBoss ? this.tileSize * 0.42 : (isFlying ? this.tileSize * 0.38 : this.tileSize * 0.32));
            const bobLift = Math.max(0, (e.bobY || 0) / (isFlying ? 10 : 5.5));
            const sw = baseW * (1 - bobLift * 0.2);
            const sh = baseH * (1 - bobLift * 0.2);
            const sa = (isFlying ? 0.18 : 0.32) * (1 - bobLift * 0.3);

            graphics.beginFill(0x000000, sa).drawEllipse(e.x, sy, sw, sh).endFill();
        }

        // 2. Enemy Sprites & Auras
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const isBoss = e.isBoss;
            const renderX = e.x;
            const renderY = e.y - (e.bobY || 0);

            // Sprite Rendering (Guaranteed sprite for all enemies & minions)
            const texture = this.enemyTextures[e.type.name] || (e.type.image && this.enemyTextures[e.type.image]) || this.enemyTextures['Normal'] || Object.values(this.enemyTextures)[0];
            if (texture) {
                if (!e._sprite) {
                    e._sprite = new PIXI.Sprite(texture);
                    e._sprite.anchor.set(0.5);
                    stage.addChild(e._sprite);
                }
                e._sprite.x = renderX;
                e._sprite.y = renderY;
                e._sprite.rotation = e.tilt || 0;

                const targetSize = isBoss ? this.tileSize * 1.2 : this.tileSize * 0.8;
                const baseScale = Math.min(targetSize / texture.width, targetSize / texture.height);
                e._sprite.scale.set(baseScale * (e.facing || 1) * (e.scaleXMod || 1), baseScale * (e.scaleYMod || 1));

                // Trait / Elemental Base Tints
                let baseTint = 0xffffff;
                if (e.trait === 'shielded') baseTint = 0x93c5fd; // Steel Blue
                else if (e.trait === 'splitter') baseTint = 0xd8b4fe; // Purple
                else if (e.trait === 'healer') baseTint = 0x86efac; // Emerald Green

                // Hit Flash / Enrage Tint Overrides
                if (e.hitFlash > 0) {
                    e._sprite.tint = 0xff7777;
                } else if (e.enraged) {
                    e._sprite.tint = 0xff4444;
                } else if (e.statuses['soaked']) {
                    e._sprite.tint = 0x88ccff;
                } else if (e.statuses['sunder']) {
                    e._sprite.tint = 0xddaa77;
                } else {
                    e._sprite.tint = baseTint;
                }
                e._sprite.visible = true;
            } else {
                // Procedural Fallback Avatar (Guarantees enemy is never invisible)
                const col = parseInt(e.type.color || '0xcccccc');
                const rad = isBoss ? this.tileSize * 0.55 : this.tileSize * 0.35;
                graphics.beginFill(col, 0.95).drawCircle(renderX, renderY, rad).endFill();
                graphics.lineStyle(2, 0xffffff, 0.8).drawCircle(renderX, renderY, rad);
                const eyeOff = (e.facing || 1) * (rad * 0.35);
                graphics.beginFill(0xffffff).drawCircle(renderX + eyeOff - 4, renderY - 3, 3).drawCircle(renderX + eyeOff + 4, renderY - 3, 3).endFill();
                graphics.beginFill(0x000000).drawCircle(renderX + eyeOff - 3, renderY - 3, 1.5).drawCircle(renderX + eyeOff + 5, renderY - 3, 1.5).endFill();
            }

            // Shield Bubble for Shielded Trait
            if (e.shieldHits > 0) {
                const sRadius = isBoss ? this.tileSize * 0.75 : this.tileSize * 0.52;
                graphics.lineStyle(2.5, 0x38bdf8, 0.85).drawCircle(renderX, renderY, sRadius);
                graphics.beginFill(0x38bdf8, 0.15).drawCircle(renderX, renderY, sRadius).endFill();
            }

            // Selected Reticle
            if (selectedEnemy === e) {
                graphics.lineStyle(2.5, 0xfacc15, 0.9).drawCircle(renderX, renderY, (isBoss ? this.tileSize * 0.75 : this.tileSize * 0.5) + 6);
            }

            // Slow Frost Aura
            if (e.statuses['slow']) {
                const pulse = 0.5 + Math.sin(nowTime * 0.01) * 0.2;
                graphics.lineStyle(2.5, 0x6ecede, 0.8 * pulse).drawCircle(renderX, renderY, (isBoss ? this.tileSize * 0.75 : this.tileSize * 0.5) + pulse * 4);
            }

            // Burn Fire Aura
            if (e.statuses['burn']) {
                const pulse = 0.6 + Math.sin(nowTime * 0.02) * 0.3;
                graphics.lineStyle(2, 0xff4400, pulse).drawCircle(renderX, renderY, (isBoss ? this.tileSize * 0.7 : this.tileSize * 0.45));
            }

            // 3. Health Bar (Background, White Chip Bar, Active HP Bar)
            const hpPct = Math.max(0, e.hp / e.maxHp);
            const chipPct = Math.max(0, e.chipHp / e.maxHp);
            const barW = isBoss ? this.tileSize * 1.5 : this.tileSize * 0.9;
            const barH = 5;
            const barX = renderX - barW / 2;
            const barY = renderY - (isBoss ? this.tileSize * 0.75 : this.tileSize * 0.55);

            // Background
            graphics.beginFill(0x0f172a, 0.85).drawRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3).endFill();

            // Trailing White Chip Damage Bar
            if (chipPct > hpPct) {
                graphics.beginFill(0xffffff, 0.8).drawRoundedRect(barX, barY, barW * chipPct, barH, 2).endFill();
            }

            // Active Color Bar
            let barColor = 0x10b981; // Green
            if (hpPct < 0.3) barColor = 0xf43f5e; // Red
            else if (hpPct < 0.6) barColor = 0xf59e0b; // Amber

            graphics.beginFill(barColor, 0.95).drawRoundedRect(barX, barY, barW * hpPct, barH, 2).endFill();
        }
    }

    clear() {
        this.enemies.forEach(e => {
            if (e._sprite) {
                e._sprite.visible = false;
                e._sprite = null;
            }
            if (e._emojiText) {
                e._emojiText.visible = false;
                e._emojiText = null;
            }
        });
        this.enemies = [];
    }
}
