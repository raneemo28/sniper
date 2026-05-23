import * as THREE from 'three';
import { Enemy } from '../components/Enemy';
/**
 * Generates wave difficulty.
 * targetSpeed and targetHealth are passed to the Enemy class.
 */
function buildWaveConfig(waveNumber) {
    return {
        waveNumber,
        targetCount: 3 + waveNumber * 2,
        // "Runner" speeds: starts fast and gets faster
        targetSpeed: 4.0 + waveNumber * 0.5,
        // Multi-hit health: starts at 2 hits, increases every 3 waves
        targetHealth: 2 + Math.floor(waveNumber / 3),
        spawnIntervalMs: Math.max(400, 1200 - waveNumber * 100),
        timeLimitSec: 40 + waveNumber * 5,
    };
}
export class WaveSystem {
    emitter;
    scene;
    playerPos;
    enemies = [];
    state = 'idle';
    currentWave = 0;
    config = null;
    spawnQueue = 0;
    spawnTimer = 0;
    waveTimer = 0;
    countdownTimer = 0;
    COUNTDOWN_SEC = 3;
    constructor(scene, playerPos, emitter) {
        this.scene = scene;
        this.playerPos = playerPos;
        this.emitter = emitter;
        this.subscribeToEvents();
    }
    subscribeToEvents() {
        // Start next wave when UI/Game requests
        this.emitter.on('game:start', () => this.nextWave());
        this.emitter.on('game:reset', () => {
            this.currentWave = 0;
            this.cleanup();
            this.state = 'idle';
        });
        // When a target is killed, remove it from our tracking list
        this.emitter.on('target:killed', (data) => {
            // Logic to remove enemy from array would go here if using instance tracking
            // For now, we check the length in the update loop
        });
    }
    nextWave() {
        this.currentWave++;
        this.config = buildWaveConfig(this.currentWave);
        this.state = 'countdown';
        this.countdownTimer = 0;
        this.emitter.emit('wave:start', {
            waveNumber: this.currentWave,
            config: this.config
        });
    }
    update(delta) {
        switch (this.state) {
            case 'countdown':
                this.tickCountdown(delta);
                break;
            case 'spawning':
                this.tickSpawning(delta);
                break;
            case 'active':
                this.tickActive(delta);
                break;
        }
        // Update all live enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(delta);
            // If enemy marked itself dead, cleanup
            // (Assumes Enemy class has an isDead property)
            // @ts-ignore - accessing private for cleanup logic
            if (enemy.isDead) {
                this.enemies.splice(i, 1);
            }
        }
    }
    tickCountdown(delta) {
        this.countdownTimer += delta;
        if (this.countdownTimer >= this.COUNTDOWN_SEC) {
            this.beginSpawning();
        }
    }
    beginSpawning() {
        if (!this.config)
            return;
        this.state = 'spawning';
        this.spawnQueue = this.config.targetCount;
        this.spawnTimer = 0;
        this.waveTimer = 0;
    }
    tickSpawning(delta) {
        this.spawnTimer += delta * 1000; // to ms
        if (this.config && this.spawnQueue > 0 && this.spawnTimer >= this.config.spawnIntervalMs) {
            this.spawnTarget();
            this.spawnQueue--;
            this.spawnTimer = 0;
        }
        if (this.spawnQueue <= 0) {
            this.state = 'active';
        }
    }
    tickActive(delta) {
        this.waveTimer += delta;
        // Check for win condition: all enemies cleared
        if (this.enemies.length === 0 && this.spawnQueue <= 0) {
            this.state = 'complete';
            this.emitter.emit('wave:complete', { waveNumber: this.currentWave });
            // Auto-start next wave after a delay
            setTimeout(() => this.nextWave(), 3000);
        }
        // Check for fail condition: time limit
        if (this.config && this.waveTimer > this.config.timeLimitSec) {
            this.state = 'failed';
            this.emitter.emit('ui:gameover');
        }
    }
    spawnTarget() {
        if (!this.config)
            return;
        const position = this.randomSpawnPosition();
        // FIX: Pass all required arguments to the Enemy constructor
        const enemy = new Enemy(this.scene, position, this.playerPos, this.emitter, this.config.targetHealth, this.config.targetSpeed);
        this.enemies.push(enemy);
    }
    randomSpawnPosition() {
        const spread = 38; // Slightly inside the 40x40 rooftop
        const x = (Math.random() - 0.5) * spread;
        const z = (Math.random() - 0.5) * spread;
        return new THREE.Vector3(x, 0, z);
    }
    cleanup() {
        this.enemies.forEach(e => e.destroy());
        this.enemies = [];
    }
    reset() {
        this.currentWave = 0;
        this.state = 'idle';
        this.spawnQueue = 0;
        this.waveTimer = 0;
        this.cleanup(); // Deletes all mesh objects from the scene
    }
}
