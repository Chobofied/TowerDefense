// src/towers.js - Tower Entities, Targeting AI, Specializations, Projectiles & Overlays

export class TowerManager {
    constructor(tileSize = 48, specializationsConfig = {}, elementsConfig = {}) {
        this.tileSize = tileSize;
        this.specializations = specializationsConfig;
        this.elements = elementsConfig;
        this.towers = [];
        this.projectiles = [];
        this.towerTextures = {};
        this.showAllRanges = false;
    }

    setTextures(textures) {
        this.towerTextures = textures;
    }

    createTower(towerType, tx, ty, currentWave = 1, isGameRunning = false) {
        const tower = {
            id: 't_' + Math.random().toString(36).substr(2, 9),
            type: { ...towerType },
            baseType: towerType,
            x: tx,
            y: ty,
            level: 1,
            cooldown: 0,
            angle: 0,
            targetAngle: 0,
            recoil: 0,
            target: null,
            idleScanPhase: Math.random() * Math.PI * 2,

            // Targeting Mode: 'first' | 'last' | 'strongest' | 'weakest' | 'closest' | 'flying'
            targetingMode: towerType.flyingOnly ? 'flying' : 'first',

            // Specialization Path
            specialization: null,

            // Lifetime Performance Tracking
            lifetimeDamage: 0,
            lifetimeKills: 0,
            shotsFired: 0,

            // 100% Sell Grace Period Tracking
            placedAtTime: Date.now(),
            placedAtWave: currentWave,
            placedDuringPrep: !isGameRunning,

            // EMP Disruption (Boss Ability)
            disruptedTimer: 0,

            _sprite: null
        };

        this.towers.push(tower);
        return tower;
    }

    removeTower(tower) {
        if (tower._sprite) {
            tower._sprite.visible = false;
            tower._sprite = null;
        }
        this.towers = this.towers.filter(t => t !== tower);
    }

    getSellValue(tower, sellRefundRatio = 0.5, gracePeriodSec = 5, currentWave = 1, isGameRunning = false) {
        const now = Date.now();
        const isWithinTimeGrace = (now - tower.placedAtTime) <= (gracePeriodSec * 1000);
        const isStillInPrep = tower.placedDuringPrep && !isGameRunning && (currentWave === tower.placedAtWave);

        if (isWithinTimeGrace || isStillInPrep) {
            // Full 100% refund
            return tower.type.cost;
        }
        return Math.floor(tower.type.cost * sellRefundRatio * tower.level);
    }

    getUpgradeCost(tower, costMultiplier = 0.7, discount = 0) {
        const baseCost = Math.floor(tower.type.cost * costMultiplier * tower.level);
        return Math.max(5, Math.floor(baseCost * (1 - discount)));
    }

    applySpecialization(tower, specId) {
        const specs = this.specializations[tower.baseType.name] || [];
        const spec = specs.find(s => s.id === specId);
        if (!spec) return false;

        tower.specialization = spec;

        // Apply spec modifiers to tower stats
        if (spec.rangeBonus) tower.type.range += spec.rangeBonus;
        if (spec.fireRateMult) tower.type.fireRate *= spec.fireRateMult;
        if (spec.damageMult) tower.type.damage = Math.round(tower.type.damage * spec.damageMult);
        if (spec.critChanceBonus) tower.type.critChance = Math.min(1.0, tower.type.critChance + spec.critChanceBonus);
        if (spec.critMultBonus) tower.type.critMultiplier += spec.critMultBonus;
        if (spec.splashRadius) tower.type.splashRadius = spec.splashRadius;
        if (spec.splashRadiusBonus) tower.type.splashRadius = (tower.type.splashRadius || 60) + spec.splashRadiusBonus;
        if (spec.splashDamageRatio) tower.type.splashDamageRatio = spec.splashDamageRatio;
        if (spec.splashRatioBonus) tower.type.splashDamageRatio = (tower.type.splashDamageRatio || 0.5) + spec.splashRatioBonus;

        return true;
    }

    cycleTargetingMode(tower) {
        const modes = ['first', 'last', 'strongest', 'weakest', 'closest'];
        if (tower.type.flyingOnly) {
            tower.targetingMode = 'flying';
            return 'flying';
        }
        const currIdx = modes.indexOf(tower.targetingMode);
        const nextIdx = (currIdx + 1) % modes.length;
        tower.targetingMode = modes[nextIdx];
        return tower.targetingMode;
    }

    // --- Targeting Selection AI ---
    selectTarget(tower, inRangeEnemies) {
        if (!inRangeEnemies || inRangeEnemies.length === 0) return null;

        const tMode = tower.targetingMode || 'first';

        if (tMode === 'strongest') {
            return inRangeEnemies.reduce((max, e) => (e.hp > max.hp ? e : max), inRangeEnemies[0]);
        }
        if (tMode === 'weakest') {
            return inRangeEnemies.reduce((min, e) => (e.hp < min.hp ? e : min), inRangeEnemies[0]);
        }
        if (tMode === 'closest') {
            const tcx = tower.x * this.tileSize + this.tileSize / 2;
            const tcy = tower.y * this.tileSize + this.tileSize / 2;
            return inRangeEnemies.reduce((closest, e) => {
                const d1 = Math.hypot(e.x - tcx, e.y - tcy);
                const d2 = Math.hypot(closest.x - tcx, closest.y - tcy);
                return d1 < d2 ? e : closest;
            }, inRangeEnemies[0]);
        }
        if (tMode === 'last') {
            return inRangeEnemies[inRangeEnemies.length - 1];
        }

        // Default 'first' / 'flying'
        return inRangeEnemies[0];
    }

    // --- Calculate Combat Damage with Elements & Crits ---
    calculateDamage(tower, target) {
        const baseDamage = tower.type.damage * tower.level;
        const variation = tower.type.damageVariation || 0.15;
        const minDamage = baseDamage * (1 - variation);
        const maxDamage = baseDamage * (1 + variation);
        let rolledDamage = minDamage + Math.random() * (maxDamage - minDamage);

        // Check Critical Hit
        const isCritical = Math.random() < (tower.type.critChance || 0.1);
        if (isCritical) {
            rolledDamage *= (tower.type.critMultiplier || 2.0);
        }

        // Specialization: Executioner bonus (<40% HP)
        if (tower.specialization && tower.specialization.id === 'executioner') {
            if ((target.hp / target.maxHp) <= (tower.specialization.executeThreshold || 0.4)) {
                rolledDamage *= 1.5;
            }
        }

        // Elemental Multipliers
        let elementalEffect = null;
        let elementalMultiplier = 1.0;

        const attackerElement = tower.type.element || 'physical';
        const targetElement = target.type.element || 'physical';

        if (attackerElement !== 'physical' && target.type.elementalProperties) {
            const weaknesses = target.type.elementalProperties.weaknesses || {};
            const resistances = target.type.elementalProperties.resistances || {};

            if (weaknesses[attackerElement]) {
                elementalMultiplier = 1.0 + weaknesses[attackerElement];
                elementalEffect = 'weakness';
            } else if (resistances[attackerElement]) {
                elementalMultiplier = Math.max(0.2, 1.0 - resistances[attackerElement]);
                elementalEffect = 'resistance';
            }
        }

        // Check target Soaked amplification
        if (target.statuses && target.statuses['soaked'] && (attackerElement === 'earth' || attackerElement === 'slow')) {
            elementalMultiplier *= 1.3;
        }

        // Check target Sunder armor reduction
        if (target.statuses && target.statuses['sunder']) {
            rolledDamage *= 1.25;
        }

        const finalDamage = Math.round(rolledDamage * elementalMultiplier * 10) / 10;

        return {
            damage: finalDamage,
            isCritical,
            elementalEffect,
            elementalMultiplier
        };
    }

    // --- Update Towers & Combat ---
    update(delta, enemies, effects, audio, meta, boostActive, activeEffects) {
        for (const tower of this.towers) {
            // Check EMP Disruption
            if (tower.disruptedTimer > 0) {
                tower.disruptedTimer -= delta / 60;
                continue;
            }

            // Fire rate multipliers
            let fireRateMultiplier = 1.0;
            if (boostActive) fireRateMultiplier *= 2.0;

            const fireRateEffect = activeEffects.find(e => e.type === 'fireRate');
            if (fireRateEffect) fireRateMultiplier *= (1 + fireRateEffect.multiplier);

            tower.cooldown -= (delta / 60) * fireRateMultiplier;

            const tcx = tower.x * this.tileSize + this.tileSize / 2;
            const tcy = tower.y * this.tileSize + this.tileSize / 2;

            // Filter in-range enemies
            let validTargets = enemies.filter(e => {
                if (!e.alive) return false;
                if (tower.type.flyingOnly && !e.flying) return false;
                if (tower.type.name === 'Melee' && e.flying) return false;
                return Math.hypot(e.x - tcx, e.y - tcy) <= tower.type.range;
            });

            // Target Selection AI
            const primeTarget = this.selectTarget(tower, validTargets);

            if (primeTarget) {
                tower.target = primeTarget;
                const desiredAngle = Math.atan2(primeTarget.y - tcy, primeTarget.x - tcx) + Math.PI / 2;
                tower.targetAngle = desiredAngle;
            } else {
                tower.target = null;
                tower.idleScanPhase += delta * 0.025;
                tower.targetAngle = Math.sin(tower.idleScanPhase) * 0.22;
            }

            // Smooth Angle Lerp
            let diff = (tower.targetAngle - tower.angle) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;
            tower.angle += diff * 0.2;

            // Recoil decay
            if (tower.recoil > 0) tower.recoil = Math.max(0, tower.recoil - delta * 0.12);

            // --- Attack Execution ---
            if (tower.cooldown <= 0 && primeTarget) {
                tower.cooldown = tower.type.fireRate;
                tower.recoil = 1.0;
                tower.shotsFired++;
                audio.playShoot(tower.baseType.name);

                if (tower.type.name === 'Melee') {
                    // Melee Cleave
                    const isWhirlwind = tower.specialization && tower.specialization.id === 'whirlwind';
                    effects.swordSwings.push({
                        x: tcx, y: tcy,
                        radius: tower.type.range,
                        duration: 15,
                        angle: tower.angle - Math.PI / 2,
                        color: tower.type.color || 0xde6e6e,
                        fullCircle: isWhirlwind
                    });

                    for (const target of validTargets) {
                        const { damage, isCritical, elementalEffect, elementalMultiplier } = this.calculateDamage(tower, target);

                        // Process Shielded Trait
                        if (target.shieldHits > 0) {
                            target.shieldHits--;
                            effects.addDamageNumber(target.x, target.y - 20, 0, false, 'resistance');
                            continue;
                        }

                        target.hp -= damage;
                        target.hitFlash = 6;
                        tower.lifetimeDamage += damage;
                        meta.recordDamage(damage, tower.type.element);
                        effects.addDamageNumber(target.x, target.y - 20, damage, isCritical, elementalEffect, elementalMultiplier);

                        // Inflict Bleed Status
                        if (target.alive) {
                            effects.applyStatus?.(target, 'bleed', 3.0);
                        }

                        if (target.hp <= 0) {
                            tower.lifetimeKills++;
                        }
                    }
                } else {
                    // Ranged Attacks: Spawn Projectile / Laser
                    const barrelDist = this.tileSize * 0.42;
                    effects.muzzleFlashes.push({
                        x: tcx + Math.sin(tower.angle) * barrelDist,
                        y: tcy - Math.cos(tower.angle) * barrelDist,
                        angle: tower.angle,
                        radius: 11 + tower.level * 2,
                        duration: 6,
                        maxDuration: 6,
                        color: tower.type.color || 0xffd700
                    });

                    const { damage, isCritical, elementalEffect, elementalMultiplier } = this.calculateDamage(tower, primeTarget);

                    this.projectiles.push({
                        x: tcx + Math.sin(tower.angle) * (barrelDist * 0.6),
                        y: tcy - Math.cos(tower.angle) * (barrelDist * 0.6),
                        tx: primeTarget.x,
                        ty: primeTarget.y,
                        target: primeTarget,
                        originTower: tower,
                        damage,
                        isCritical,
                        elementalEffect,
                        elementalMultiplier,
                        color: tower.type.color || 0xffffff,
                        speed: tower.type.flyingOnly ? 12 : (tower.type.name === 'Sniper' ? 16 : 8 + tower.level),
                        pierce: !!(tower.specialization && tower.specialization.pierce),
                        splashRadius: tower.type.splashRadius || 0,
                        splashDamageRatio: tower.type.splashDamageRatio || 0
                    });
                }
            }
        }

        // --- Update Projectiles ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const targetX = p.target && p.target.alive ? p.target.x : p.tx;
            const targetY = p.target && p.target.alive ? p.target.y : p.ty;
            const dx = targetX - p.x;
            const dy = targetY - p.y;
            const dist = Math.hypot(dx, dy);

            p.dirX = dx / (dist || 1);
            p.dirY = dy / (dist || 1);

            if (dist < p.speed) {
                p.x = targetX;
                p.y = targetY;

                // Hit target
                if (p.target && p.target.alive) {
                    if (p.target.shieldHits > 0) {
                        p.target.shieldHits--;
                        effects.addDamageNumber(p.target.x, p.target.y - 20, 0, false, 'resistance');
                    } else {
                        p.target.hp -= p.damage;
                        p.target.hitFlash = 6;
                        p.originTower.lifetimeDamage += p.damage;
                        meta.recordDamage(p.damage, p.originTower.type.element);
                        effects.addDamageNumber(p.target.x, p.target.y - 20, p.damage, p.isCritical, p.elementalEffect, p.elementalMultiplier);

                        if (p.target.hp <= 0) p.originTower.lifetimeKills++;

                        // Apply Status Effects Based on Tower Type
                        const el = p.originTower.type.element;
                        if (el === 'slow') {
                            p.target.statuses['slow'] = { duration: 2.5, slowAmount: 0.4 };
                        } else if (el === 'fire') {
                            p.target.statuses['burn'] = { duration: 4.0, tickTimer: 0, tickInterval: 0.8, damagePercentMaxHp: 0.025 };
                        } else if (el === 'water') {
                            p.target.statuses['soaked'] = { duration: 5.0, damageMultiplier: 1.3 };
                        } else if (el === 'earth') {
                            p.target.statuses['sunder'] = { duration: 4.0, armorReduction: 0.3 };
                        }

                        // Specialization: Permafrost freeze
                        if (p.originTower.specialization && p.originTower.specialization.freezeChance) {
                            if (Math.random() < p.originTower.specialization.freezeChance) {
                                p.target.statuses['stun'] = { duration: p.originTower.specialization.freezeDuration || 1.2 };
                            }
                        }
                    }
                }

                // Splash Damage
                if (p.splashRadius > 0) {
                    effects.splashEffects.push({
                        x: p.x, y: p.y,
                        radius: 0,
                        maxRadius: p.splashRadius,
                        color: p.color,
                        alpha: 1,
                        duration: 18
                    });

                    const splashDmg = p.damage * p.splashDamageRatio;
                    for (const other of enemies) {
                        if (other !== p.target && other.alive && Math.hypot(other.x - p.x, other.y - p.y) <= p.splashRadius) {
                            other.hp -= splashDmg;
                            other.hitFlash = 5;
                            p.originTower.lifetimeDamage += splashDmg;
                            meta.recordDamage(splashDmg, p.originTower.type.element);
                            effects.addSplashDamageNumber(other.x, other.y - 18, splashDmg);
                            if (other.hp <= 0) p.originTower.lifetimeKills++;
                        }
                    }
                }

                this.projectiles.splice(i, 1);
            } else {
                p.x += p.dirX * p.speed * delta;
                p.y += p.dirY * p.speed * delta;
            }
        }
    }

    // --- Draw Towers, Specialization Runes & Overlays ---
    draw(graphics, stage, selectedTower, hoverTower, selectedTowers = []) {
        const nowTime = Date.now();

        // 1. Draw All-Towers Range Overlay (if Shift is held or enabled)
        if (this.showAllRanges) {
            for (const t of this.towers) {
                const cx = t.x * this.tileSize + this.tileSize / 2;
                const cy = t.y * this.tileSize + this.tileSize / 2;
                graphics.lineStyle(1.5, t.type.color || 0x38bdf8, 0.25).drawCircle(cx, cy, t.type.range);
                graphics.beginFill(t.type.color || 0x38bdf8, 0.04).drawCircle(cx, cy, t.type.range).endFill();
            }
        }

        // 2. Towers Rendering
        for (const t of this.towers) {
            const cx = t.x * this.tileSize + this.tileSize / 2;
            const cy = t.y * this.tileSize + this.tileSize / 2;

            const recoilDist = (t.recoil || 0) * (4.5 + t.level * 0.6);
            const recoilX = -Math.sin(t.angle || 0) * recoilDist;
            const recoilY = Math.cos(t.angle || 0) * recoilDist;

            const texture = this.towerTextures[t.baseType.name];
            if (texture) {
                if (!t._sprite) {
                    t._sprite = new PIXI.Sprite(texture);
                    t._sprite.anchor.set(0.5);
                    stage.addChild(t._sprite);
                }
                t._sprite.x = cx + recoilX;
                t._sprite.y = cy + recoilY;
                t._sprite.rotation = t.angle || 0;

                const targetSize = this.tileSize * 0.9;
                const baseScale = Math.min(targetSize / texture.width, targetSize / texture.height);
                t._sprite.scale.set(baseScale * (1 - (t.recoil || 0) * 0.08), baseScale * (1 + (t.recoil || 0) * 0.12));

                // Disrupted EMP tint
                if (t.disruptedTimer > 0) {
                    t._sprite.tint = 0x38bdf8;
                } else {
                    t._sprite.tint = 0xffffff;
                }
                t._sprite.visible = true;
            }

            const radius = this.tileSize * 0.42;

            // Visual Upgrade Rings (Level 2+)
            if (t.level >= 2) graphics.lineStyle(1.5, 0xffffff, 0.4).drawCircle(cx, cy, radius * 1.15);
            if (t.level >= 3) graphics.lineStyle(2, 0xffffff, 0.7).drawCircle(cx, cy, radius * 1.25);
            if (t.level >= 4) {
                graphics.lineStyle(2.5, 0xfacc15, 0.85).drawCircle(cx, cy, radius * 1.35);
                // Orbiting Energy Sparks
                const orbitA = (nowTime * 0.003) + (t.x * 2 + t.y);
                const orbR = radius * 1.35;
                graphics.beginFill(0xfacc15, 0.9).drawCircle(cx + Math.cos(orbitA) * orbR, cy + Math.sin(orbitA) * orbR, 2.5).endFill();
            }
            if (t.specialization) {
                // Spec Aura
                graphics.lineStyle(2.5, 0xec4899, 0.85).drawCircle(cx, cy, radius * 1.45);
            }

            // EMP Disrupted Arc
            if (t.disruptedTimer > 0) {
                graphics.lineStyle(2, 0x38bdf8, 0.8).drawCircle(cx, cy, radius * 1.2);
            }
        }

        // 3. Multi-Tower Selection Highlights & Ranges
        if (selectedTowers && selectedTowers.length > 0) {
            for (const t of selectedTowers) {
                const cx = t.x * this.tileSize + this.tileSize / 2;
                const cy = t.y * this.tileSize + this.tileSize / 2;

                // Glowing bounding bracket
                graphics.lineStyle(2, 0x38bdf8, 0.9).drawRoundedRect(t.x * this.tileSize + 2, t.y * this.tileSize + 2, this.tileSize - 4, this.tileSize - 4, 6);
                graphics.beginFill(0x38bdf8, 0.12).drawRoundedRect(t.x * this.tileSize + 2, t.y * this.tileSize + 2, this.tileSize - 4, this.tileSize - 4, 6).endFill();

                // Tower range
                graphics.lineStyle(1.5, t.type.color || 0x38bdf8, 0.35).drawCircle(cx, cy, t.type.range);
                graphics.beginFill(t.type.color || 0x38bdf8, 0.03).drawCircle(cx, cy, t.type.range).endFill();
            }
        }

        // 4. Single Selected / Hovered Tower Range & Line-of-Sight Laser
        const activeTower = selectedTower || hoverTower;
        if (activeTower && (!selectedTowers || selectedTowers.length <= 1)) {
            const cx = activeTower.x * this.tileSize + this.tileSize / 2;
            const cy = activeTower.y * this.tileSize + this.tileSize / 2;

            graphics.lineStyle(2, 0x38bdf8, 0.7).drawCircle(cx, cy, activeTower.type.range);
            graphics.beginFill(0x38bdf8, 0.08).drawCircle(cx, cy, activeTower.type.range).endFill();

            // Line of Sight Targeting Reticle Laser
            if (activeTower.target && activeTower.target.alive) {
                graphics.lineStyle(1.5, 0xf43f5e, 0.6);
                graphics.moveTo(cx, cy).lineTo(activeTower.target.x, activeTower.target.y);
                graphics.lineStyle(1.5, 0xf43f5e, 0.8).drawCircle(activeTower.target.x, activeTower.target.y, 8);
            }
        }

        // 4. Projectiles
        for (const p of this.projectiles) {
            graphics.beginFill(p.color, 0.9).drawCircle(p.x, p.y, 5.5).endFill();
            graphics.beginFill(0xffffff, 0.8).drawCircle(p.x, p.y, 2.5).endFill();
            if (p.dirX !== undefined) {
                graphics.lineStyle(2, p.color, 0.5).moveTo(p.x, p.y).lineTo(p.x - p.dirX * 10, p.y - p.dirY * 10);
            }
        }
    }

    getMvpTower() {
        if (this.towers.length === 0) return null;
        return this.towers.reduce((best, t) => {
            const score1 = (t.lifetimeDamage || 0) + (t.lifetimeKills || 0) * 50;
            const score2 = (best.lifetimeDamage || 0) + (best.lifetimeKills || 0) * 50;
            return score1 > score2 ? t : best;
        }, this.towers[0]);
    }

    clear() {
        this.towers.forEach(t => {
            if (t._sprite) {
                t._sprite.visible = false;
                t._sprite = null;
            }
        });
        this.towers = [];
        this.projectiles = [];
    }
}
