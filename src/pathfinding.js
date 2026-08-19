// src/pathfinding.js - A* Pathfinding & Constant-Speed Animated Flow Line Visualizer

export class PathfindingManager {
    constructor(gridSize = 14, tileSize = 48) {
        this.gridSize = gridSize;
        this.tileSize = tileSize;
        this.grid = [];
        this.flowPixelOffset = 0;
        this.cachedPaths = new Map(); // key: "startX,startY->endX,endY"
    }

    createGrid(obstacles = [], towers = []) {
        this.grid = [];
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                const isObstacle = obstacles.some(o => o.x === x && o.y === y);
                const isTower = towers.some(t => t.x === x && t.y === y);
                row.push({
                    x, y,
                    blocked: isObstacle || isTower,
                    isObstacle
                });
            }
            this.grid.push(row);
        }
        this.cachedPaths.clear();
        return this.grid;
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    getNeighbors(node) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const result = [];
        for (const [dx, dy] of dirs) {
            const nx = node.x + dx;
            const ny = node.y + dy;
            if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                if (!this.grid[ny][nx].blocked) {
                    result.push(this.grid[ny][nx]);
                }
            }
        }
        return result;
    }

    findPath(start, end) {
        if (!start || !end) return null;
        if (start.x < 0 || start.x >= this.gridSize || start.y < 0 || start.y >= this.gridSize) return null;
        if (end.x < 0 || end.x >= this.gridSize || end.y < 0 || end.y >= this.gridSize) return null;

        const cacheKey = `${start.x},${start.y}->${end.x},${end.y}`;
        if (this.cachedPaths.has(cacheKey)) {
            return this.cachedPaths.get(cacheKey);
        }

        const startNode = this.grid[start.y][start.x];
        const endNode = this.grid[end.y][end.x];

        const open = [startNode];
        const cameFrom = new Map();
        const gScore = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(Infinity));
        gScore[start.y][start.x] = 0;
        const fScore = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(Infinity));
        fScore[start.y][start.x] = this.heuristic(start, end);

        while (open.length > 0) {
            open.sort((a, b) => fScore[a.y][a.x] - fScore[b.y][b.x]);
            const current = open.shift();

            if (current.x === end.x && current.y === end.y) {
                const path = [];
                let curr = current;
                while (cameFrom.has(curr)) {
                    path.push(curr);
                    curr = cameFrom.get(curr);
                }
                path.push(startNode);
                const reversed = path.reverse();
                this.cachedPaths.set(cacheKey, reversed);
                return reversed;
            }

            for (const neighbor of this.getNeighbors(current)) {
                const tentativeG = gScore[current.y][current.x] + 1;
                if (tentativeG < gScore[neighbor.y][neighbor.x]) {
                    cameFrom.set(neighbor, current);
                    gScore[neighbor.y][neighbor.x] = tentativeG;
                    fScore[neighbor.y][neighbor.x] = tentativeG + this.heuristic(neighbor, end);
                    if (!open.includes(neighbor)) open.push(neighbor);
                }
            }
        }

        return null;
    }

    // Validate if placing a tower at (tx, ty) keeps all paths open
    canPlaceTower(tx, ty, starts, ends, activeEnemies = [], obstacles = [], towers = []) {
        if (tx < 0 || tx >= this.gridSize || ty < 0 || ty >= this.gridSize) return false;
        if (obstacles.some(o => o.x === tx && o.y === ty)) return false;
        if (towers.some(t => t.x === tx && t.y === ty)) return false;
        if (starts.some(s => s.x === tx && s.y === ty)) return false;
        if (ends.some(e => e.x === tx && e.y === ty)) return false;

        // Temporarily mark blocked
        this.grid[ty][tx].blocked = true;
        this.cachedPaths.clear();

        let valid = true;

        // Check each start to at least one end
        for (const s of starts) {
            let hasExit = false;
            for (const e of ends) {
                if (this.findPath(s, e)) {
                    hasExit = true;
                    break;
                }
            }
            if (!hasExit) {
                valid = false;
                break;
            }
        }

        // Check active moving ground enemies
        if (valid) {
            for (const enemy of activeEnemies) {
                if (!enemy.flying && enemy.alive) {
                    const egx = Math.max(0, Math.min(this.gridSize - 1, Math.round((enemy.x - this.tileSize / 2) / this.tileSize)));
                    const egy = Math.max(0, Math.min(this.gridSize - 1, Math.round((enemy.y - this.tileSize / 2) / this.tileSize)));
                    let enemyHasExit = false;
                    for (const e of ends) {
                        if (this.findPath({ x: egx, y: egy }, e)) {
                            enemyHasExit = true;
                            break;
                        }
                    }
                    if (!enemyHasExit) {
                        valid = false;
                        break;
                    }
                }
            }
        }

        // Revert
        this.grid[ty][tx].blocked = false;
        this.cachedPaths.clear();
        return valid;
    }

    // --- Dynamic Animated Path Flow Line with Fixed Pixel Speed ---
    updateFlow(delta) {
        // 45 pixels per second constant travel speed regardless of path length
        const pixelSpeed = 45;
        this.flowPixelOffset = ((this.flowPixelOffset || 0) + (pixelSpeed * delta / 60)) % 10000;
    }

    drawPathFlow(graphics, starts, ends) {
        const pathsToDraw = [];
        for (const s of starts) {
            for (const e of ends) {
                const path = this.findPath(s, e);
                if (path && path.length > 1) {
                    pathsToDraw.push(path);
                }
            }
        }

        if (pathsToDraw.length === 0) return;

        for (const path of pathsToDraw) {
            // Draw continuous soft glowing underlying line
            graphics.lineStyle(3, 0x38bdf8, 0.2);
            for (let i = 0; i < path.length - 1; i++) {
                const p1 = path[i];
                const p2 = path[i + 1];
                const x1 = p1.x * this.tileSize + this.tileSize / 2;
                const y1 = p1.y * this.tileSize + this.tileSize / 2;
                const x2 = p2.x * this.tileSize + this.tileSize / 2;
                const y2 = p2.y * this.tileSize + this.tileSize / 2;

                if (i === 0) graphics.moveTo(x1, y1);
                graphics.lineTo(x2, y2);
            }

            // Draw constant-speed flowing dots along the path
            const dotSpacing = 16;
            const totalDist = (path.length - 1) * this.tileSize;
            if (totalDist <= 0) continue;

            const baseOffset = (this.flowPixelOffset || 0) % dotSpacing;
            const numDots = Math.floor(totalDist / dotSpacing);

            for (let d = 0; d <= numDots; d++) {
                const targetPixelDist = (d * dotSpacing + baseOffset) % totalDist;

                const segmentIdx = Math.min(path.length - 2, Math.floor(targetPixelDist / this.tileSize));
                const segmentProgress = (targetPixelDist % this.tileSize) / this.tileSize;

                const p1 = path[segmentIdx];
                const p2 = path[segmentIdx + 1];

                const x1 = p1.x * this.tileSize + this.tileSize / 2;
                const y1 = p1.y * this.tileSize + this.tileSize / 2;
                const x2 = p2.x * this.tileSize + this.tileSize / 2;
                const y2 = p2.y * this.tileSize + this.tileSize / 2;

                const dotX = x1 + (x2 - x1) * segmentProgress;
                const dotY = y1 + (y2 - y1) * segmentProgress;

                // Glowing Cyan Flow Dots
                graphics.beginFill(0x38bdf8, 0.65).drawCircle(dotX, dotY, 2.4).endFill();
                graphics.beginFill(0xffffff, 0.9).drawCircle(dotX, dotY, 1.1).endFill();
            }
        }
    }
}
