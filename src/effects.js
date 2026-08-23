// src/effects.js - Screen Shake, Damage Floaties, Particle Systems & Combat FX

export class EffectsManager {
    constructor(app, stage) {
        this.app = app;
        this.stage = stage;

        // Screen Shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeDecay = 0.9;
        this.baseStageX = 0;
        this.baseStageY = 0;

        // Visual Collections
        this.damageNumbers = [];
        this.dustParticles = [];
        this.deathParticles = [];
        this.deathShockwaves = [];
        this.muzzleFlashes = [];
        this.swordSwings = [];
        this.explosions = [];
        this.splashEffects = [];
        this.groundHazards = [];
        this.empShockwaves = [];

        // Object pool for damage numbers
        this.textPool = [];
        this.initTextPool(60);
    }

    initTextPool(size = 60) {
        for (let i = 0; i < size; i++) {
            const t = new PIXI.Text('', {
                fontFamily: 'Segoe UI, sans-serif',
                fontSize: 14,
                fontWeight: 'bold',
                fill: 0xffffff,
                align: 'center',
                stroke: 0x000000,
                strokeThickness: 3,
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowBlur: 2,
                dropShadowDistance: 1
            });
            t.anchor.set(0.5);
            t.visible = false;
            this.stage.addChild(t);
            this.textPool.push(t);
        }
    }

    // --- Screen Shake ---
    triggerShake(intensity = 6, duration = 15) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }

    updateScreenShake(delta) {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= delta;
            const currentIntensity = this.shakeIntensity * (this.shakeDuration / 15);
            const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
            const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
            this.stage.position.set(this.baseStageX + offsetX, this.baseStageY + offsetY);
            if (this.shakeDuration <= 0) {
                this.shakeIntensity = 0;
                this.stage.position.set(this.baseStageX, this.baseStageY);
            }
        }
    }

    setBaseStagePos(x, y) {
        this.baseStageX = x;
        this.baseStageY = y;
        if (this.shakeDuration <= 0) {
            this.stage.position.set(x, y);
        }
    }

    // --- Damage Numbers ---
    addDamageNumber(x, y, damage, isCritical = false, elementalEffect = null, elementalMultiplier = 1) {
        const randX = (Math.random() - 0.5) * 26;
        const randYVel = isCritical ? -4.5 : -2.8 - Math.random() * 1.5;

        let color = 0xffffff;
        let prefix = '';

        if (isCritical) {
            color = 0xff8800;
            prefix = '⚡ ';
        } else if (elementalEffect === 'weakness') {
            color = 0x55ff55;
            prefix = '+';
        } else if (elementalEffect === 'resistance') {
            color = 0xff5555;
            prefix = '-';
        } else if (elementalEffect === 'burn' || elementalEffect === 'fire') {
            color = 0xff5500;
            prefix = '🔥 ';
        } else if (elementalEffect === 'bleed') {
            color = 0xde3333;
            prefix = '🩸 ';
        }

        let displayText;
        if (typeof damage === 'string') {
            displayText = damage;
        } else if (typeof damage === 'number' && !isNaN(damage)) {
            displayText = prefix + Math.floor(damage);
        } else {
            displayText = String(damage || '');
        }

        this.damageNumbers.push({
            x: x + randX,
            y: y,
            displayText,
            color,
            alpha: 1,
            life: isCritical ? 55 : 42,
            maxLife: isCritical ? 55 : 42,
            isCritical,
            xVel: (Math.random() - 0.5) * 1.8,
            yVel: randYVel,
            scale: isCritical ? 1.4 : 1.0,
            textObj: null
        });
    }

    addSplashDamageNumber(x, y, damage) {
        this.damageNumbers.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y,
            displayText: Math.floor(damage).toString(),
            color: 0xffaa00,
            alpha: 1,
            life: 35,
            maxLife: 35,
            isCritical: false,
            xVel: (Math.random() - 0.5) * 1.2,
            yVel: -2.0,
            scale: 0.95,
            textObj: null
        });
    }

    // --- Death Explosions & Bursts ---
    triggerDeathEffect(enemy) {
        const color = enemy.type.color ? (typeof enemy.type.color === 'string' ? parseInt(enemy.type.color) : enemy.type.color) : 0xffffff;
        const isBoss = enemy.type.name === 'Boss';
        const pCount = isBoss ? 28 : 12;

        // Shockwave
        this.deathShockwaves.push({
            x: enemy.x,
            y: enemy.y,
            radius: 4,
            maxRadius: isBoss ? 75 : 40,
            color: color,
            alpha: 0.9,
            duration: isBoss ? 30 : 20,
            maxDuration: isBoss ? 30 : 20
        });

        // Burst Particles
        for (let i = 0; i < pCount; i++) {
            const angle = (Math.PI * 2 * i) / pCount + (Math.random() - 0.5) * 0.5;
            const speed = isBoss ? 2.5 + Math.random() * 4.5 : 1.5 + Math.random() * 3.0;
            this.deathParticles.push({
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.0,
                radius: isBoss ? 3.5 + Math.random() * 2.5 : 2.0 + Math.random() * 1.8,
                color: color,
                alpha: 1,
                duration: isBoss ? 35 + Math.random() * 15 : 22 + Math.random() * 10,
                maxDuration: isBoss ? 45 : 28,
                gravity: 0.15
            });
        }
    }

    addGroundHazard(x, y, radius = 50, duration = 240, type = 'fire') {
        this.groundHazards.push({
            x, y, radius,
            duration,
            maxDuration: duration,
            type,
            tickTimer: 0,
            color: type === 'fire' ? 0xff4400 : 0x00ff88
        });
    }

    addEmpShockwave(x, y, radius = 130, duration = 40) {
        this.empShockwaves.push({
            x, y,
            radius: 5,
            maxRadius: radius,
            duration,
            maxDuration: duration,
            color: 0x38bdf8
        });
    }

    // --- Frame Updates ---
    update(delta) {
        this.updateScreenShake(delta);

        // Damage Floaties
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.life -= delta;
            d.y += d.yVel * delta;
            d.x += d.xVel * delta;
            d.yVel += 0.14 * delta; // Gravity
            d.alpha = Math.max(0, d.life / d.maxLife);

            if (d.life <= 0) {
                if (d.textObj) {
                    d.textObj.visible = false;
                    d.textObj = null;
                }
                this.damageNumbers.splice(i, 1);
            }
        }

        // Dust Particles
        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            const dp = this.dustParticles[i];
            dp.duration -= delta;
            dp.x += (dp.vx || 0) * delta;
            dp.y += (dp.vy || 0) * delta;
            if (dp.duration <= 0) this.dustParticles.splice(i, 1);
        }

        // Death Particles
        for (let i = this.deathParticles.length - 1; i >= 0; i--) {
            const p = this.deathParticles[i];
            p.duration -= delta;
            p.x += (p.vx || 0) * delta;
            p.y += (p.vy || 0) * delta;
            p.vy += (p.gravity || 0.15) * delta;
            p.alpha = Math.max(0, p.duration / p.maxDuration);
            if (p.duration <= 0) this.deathParticles.splice(i, 1);
        }

        // Shockwaves
        for (let i = this.deathShockwaves.length - 1; i >= 0; i--) {
            const sw = this.deathShockwaves[i];
            sw.duration -= delta;
            sw.radius += (sw.maxRadius - sw.radius) * 0.25 * delta;
            sw.alpha = Math.max(0, sw.duration / sw.maxDuration);
            if (sw.duration <= 0) this.deathShockwaves.splice(i, 1);
        }

        // EMP Shockwaves
        for (let i = this.empShockwaves.length - 1; i >= 0; i--) {
            const emp = this.empShockwaves[i];
            emp.duration -= delta;
            emp.radius += (emp.maxRadius - emp.radius) * 0.2 * delta;
            emp.alpha = Math.max(0, emp.duration / emp.maxDuration);
            if (emp.duration <= 0) this.empShockwaves.splice(i, 1);
        }

        // Muzzle Flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const mf = this.muzzleFlashes[i];
            mf.duration -= delta;
            if (mf.duration <= 0) this.muzzleFlashes.splice(i, 1);
        }

        // Sword Swings
        for (let i = this.swordSwings.length - 1; i >= 0; i--) {
            const s = this.swordSwings[i];
            s.duration -= delta;
            if (s.duration <= 0) this.swordSwings.splice(i, 1);
        }

        // Explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.duration -= delta;
            if (exp.radius < exp.maxRadius) exp.radius += (exp.maxRadius / 12) * delta;
            if (exp.duration < 25) exp.alpha = exp.duration / 25;
            if (exp.duration <= 0) this.explosions.splice(i, 1);
        }

        // Splash Effects
        for (let i = this.splashEffects.length - 1; i >= 0; i--) {
            const sp = this.splashEffects[i];
            sp.duration -= delta;
            if (sp.radius < sp.maxRadius) sp.radius += (sp.maxRadius / 10) * delta;
            if (sp.duration < 18) sp.alpha = sp.duration / 18;
            if (sp.duration <= 0) this.splashEffects.splice(i, 1);
        }

        // Ground Hazards
        for (let i = this.groundHazards.length - 1; i >= 0; i--) {
            const gh = this.groundHazards[i];
            gh.duration -= delta;
            gh.tickTimer += delta;
            if (gh.duration <= 0) this.groundHazards.splice(i, 1);
        }
    }

    // --- Render Graphics Overlay ---
    draw(graphics) {
        // Ground Hazards
        for (const gh of this.groundHazards) {
            const alpha = Math.min(0.5, gh.duration / 40);
            graphics.beginFill(gh.color, alpha * 0.4).drawCircle(gh.x, gh.y, gh.radius).endFill();
            graphics.lineStyle(2, gh.color, alpha * 0.8).drawCircle(gh.x, gh.y, gh.radius);
            for (let k = 0; k < 3; k++) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * gh.radius * 0.8;
                graphics.beginFill(0xffffaa, alpha * 0.7).drawCircle(gh.x + Math.cos(a) * r, gh.y + Math.sin(a) * r, 2 + Math.random() * 2).endFill();
            }
        }

        // Footstep Dust
        for (const dp of this.dustParticles) {
            const alpha = (dp.duration / dp.maxDuration) * 0.5;
            graphics.beginFill(dp.color || 0x94a3b8, alpha).drawCircle(dp.x, dp.y, dp.radius * (1 + (1 - dp.duration / dp.maxDuration) * 0.6)).endFill();
        }

        // Muzzle Flashes
        for (const mf of this.muzzleFlashes) {
            const p = 1 - (mf.duration / mf.maxDuration);
            const a = (mf.duration / mf.maxDuration) * 0.9;
            const r = mf.radius * (0.6 + p * 0.5);
            graphics.beginFill(mf.color || 0xffd700, a * 0.6).drawCircle(mf.x, mf.y, r).endFill();
            graphics.beginFill(0xffffff, a).drawCircle(mf.x, mf.y, r * 0.45).endFill();
        }

        // Sword Swings
        for (const swing of this.swordSwings) {
            const fade = Math.max(0, swing.duration / 15);
            const startAngle = swing.angle;
            const endAngle = startAngle + (swing.fullCircle ? Math.PI * 2 : Math.PI * 0.85);
            graphics.lineStyle(4, swing.color || 0xde6e6e, fade).arc(swing.x, swing.y, swing.radius * 0.85, startAngle, endAngle);
            graphics.lineStyle(2, 0xffffff, fade * 0.8).arc(swing.x, swing.y, swing.radius * 0.65, startAngle, endAngle);
        }

        // Death Shockwaves
        for (const sw of this.deathShockwaves) {
            graphics.lineStyle(3, sw.color, sw.alpha).drawCircle(sw.x, sw.y, sw.radius);
        }

        // EMP Shockwaves
        for (const emp of this.empShockwaves) {
            graphics.lineStyle(4, emp.color, emp.alpha).drawCircle(emp.x, emp.y, emp.radius);
            graphics.lineStyle(1, 0xffffff, emp.alpha * 0.8).drawCircle(emp.x, emp.y, emp.radius * 0.85);
        }

        // Death Particles
        for (const p of this.deathParticles) {
            graphics.beginFill(p.color, p.alpha).drawCircle(p.x, p.y, p.radius).endFill();
        }

        // Explosions
        for (const exp of this.explosions) {
            graphics.beginFill(exp.color, exp.alpha * 0.4).drawCircle(exp.x, exp.y, exp.radius).endFill();
            graphics.beginFill(0xffffff, exp.alpha * 0.7).drawCircle(exp.x, exp.y, exp.radius * 0.3).endFill();
            graphics.lineStyle(2, 0xffdd00, exp.alpha * 0.8).drawCircle(exp.x, exp.y, exp.radius * 0.8);
        }

        // Splash Effects
        for (const sp of this.splashEffects) {
            graphics.beginFill(sp.color, sp.alpha * 0.3).drawCircle(sp.x, sp.y, sp.radius).endFill();
            graphics.beginFill(0xffffff, sp.alpha * 0.6).drawCircle(sp.x, sp.y, sp.radius * 0.4).endFill();
            graphics.lineStyle(2, sp.color, sp.alpha * 0.8).drawCircle(sp.x, sp.y, sp.radius * 0.8);
        }

        // Damage Number Floaties Rendering from Object Pool
        for (const d of this.damageNumbers) {
            if (!d.textObj) {
                for (const poolText of this.textPool) {
                    if (!poolText.visible) {
                        d.textObj = poolText;
                        break;
                    }
                }
            }
            if (d.textObj) {
                d.textObj.text = d.displayText;
                d.textObj.style.fontSize = d.isCritical ? 19 : 14;
                d.textObj.style.fill = d.color;
                d.textObj.position.set(d.x, d.y);
                d.textObj.alpha = d.alpha;
                d.textObj.scale.set(d.scale || 1.0);
                d.textObj.visible = true;
            }
        }
    }

    clear() {
        this.damageNumbers.forEach(d => {
            if (d.textObj) {
                d.textObj.visible = false;
                d.textObj = null;
            }
        });
        this.damageNumbers = [];
        this.dustParticles = [];
        this.deathParticles = [];
        this.deathShockwaves = [];
        this.empShockwaves = [];
        this.muzzleFlashes = [];
        this.swordSwings = [];
        this.explosions = [];
        this.splashEffects = [];
        this.groundHazards = [];
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.stage.position.set(this.baseStageX, this.baseStageY);
    }
}
