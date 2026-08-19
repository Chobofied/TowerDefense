// src/maps.js - Multi-Map Layout Manager & Obstacle Rendering

export class MapManager {
    constructor(mapsConfig = [], tileSize = 48) {
        this.maps = mapsConfig;
        this.tileSize = tileSize;
        this.currentMap = this.maps[0] || {
            id: 'plains',
            name: 'Open Plains',
            start: { x: 0, y: 7 },
            end: { x: 13, y: 7 },
            obstacles: []
        };
    }

    setMap(mapId) {
        const found = this.maps.find(m => m.id === mapId);
        if (found) {
            this.currentMap = found;
            return true;
        }
        return false;
    }

    getCurrentMap() {
        return this.currentMap;
    }

    getStarts() {
        if (this.currentMap.multiStart && this.currentMap.multiStart.length > 0) {
            return this.currentMap.multiStart;
        }
        return [this.currentMap.start || { x: 0, y: 7 }];
    }

    getEnds() {
        if (this.currentMap.multiEnd && this.currentMap.multiEnd.length > 0) {
            return this.currentMap.multiEnd;
        }
        return [this.currentMap.end || { x: 13, y: 7 }];
    }

    getObstacles() {
        return this.currentMap.obstacles || [];
    }

    // Render rock obstacles on the canvas with beveled 3D look
    drawObstacles(graphics) {
        const obs = this.getObstacles();
        for (const o of obs) {
            const x = o.x * this.tileSize;
            const y = o.y * this.tileSize;
            const pad = 3;
            const w = this.tileSize - pad * 2;
            const h = this.tileSize - pad * 2;
            const r = 8;

            // Deep drop shadow
            graphics.beginFill(0x000000, 0.45).drawRoundedRect(x + pad + 2, y + pad + 3, w, h, r).endFill();

            // Main rock body (slate / basalt)
            graphics.beginFill(0x272e3d, 0.95).drawRoundedRect(x + pad, y + pad, w, h, r).endFill();

            // Bevel highlight top
            graphics.lineStyle(1.5, 0x64748b, 0.6).drawRoundedRect(x + pad + 1, y + pad + 1, w - 2, h - 2, r);

            // Inner cracked detail
            graphics.lineStyle(1, 0x181f2a, 0.7);
            graphics.moveTo(x + w * 0.35, y + h * 0.3).lineTo(x + w * 0.65, y + h * 0.7);
            graphics.moveTo(x + w * 0.5, y + h * 0.48).lineTo(x + w * 0.75, y + h * 0.35);

            // Glowing runic crystal in center
            graphics.beginFill(0x38bdf8, 0.4).drawCircle(x + this.tileSize / 2, y + this.tileSize / 2, 4).endFill();
            graphics.beginFill(0xffffff, 0.8).drawCircle(x + this.tileSize / 2, y + this.tileSize / 2, 1.8).endFill();
        }
    }

    // Draw spawn and exit portals
    drawPortals(graphics, pulseTime) {
        const starts = this.getStarts();
        const ends = this.getEnds();

        // Spawn Portals (Cyan Vortex)
        for (const s of starts) {
            const cx = s.x * this.tileSize + this.tileSize / 2;
            const cy = s.y * this.tileSize + this.tileSize / 2;
            const pr = this.tileSize * 0.42;
            const pulse = 1 + Math.sin(pulseTime * 0.005 + (s.x + s.y)) * 0.08;

            // Outer glow
            graphics.beginFill(0x06b6d4, 0.18).drawCircle(cx, cy, pr * 1.35 * pulse).endFill();
            // Main ring
            graphics.lineStyle(3, 0x06b6d4, 0.85).drawCircle(cx, cy, pr * pulse);
            // Core
            graphics.beginFill(0x0f172a, 0.7).drawCircle(cx, cy, pr * 0.65).endFill();
            graphics.lineStyle(1.5, 0xffffff, 0.75).drawCircle(cx, cy, pr * 0.45);
        }

        // Exit Portals (Crimson Core)
        for (const e of ends) {
            const cx = e.x * this.tileSize + this.tileSize / 2;
            const cy = e.y * this.tileSize + this.tileSize / 2;
            const pr = this.tileSize * 0.42;
            const pulse = 1 + Math.sin(pulseTime * 0.005 + (e.x + e.y) + Math.PI) * 0.08;

            // Outer glow
            graphics.beginFill(0xf43f5e, 0.18).drawCircle(cx, cy, pr * 1.35 * pulse).endFill();
            // Main ring
            graphics.lineStyle(3, 0xf43f5e, 0.85).drawCircle(cx, cy, pr * pulse);
            // Core
            graphics.beginFill(0x0f172a, 0.7).drawCircle(cx, cy, pr * 0.65).endFill();
            graphics.lineStyle(1.5, 0xffffff, 0.75).drawCircle(cx, cy, pr * 0.45);
        }
    }
}
