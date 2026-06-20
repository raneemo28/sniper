import * as THREE from 'three';
import { Enemy } from '../components/Enemy';
function buildWaveConfig(waveNumber, difficultyLevel) {
    const difficulty = Math.max(0, waveNumber - 1);
    let baseHealth = 1;
    if (difficultyLevel === 'medium')
        baseHealth = 2;
    if (difficultyLevel === 'hard')
        baseHealth = 3;
    return {
        waveNumber,
        targetCount: 3 + difficulty * 2,
        targetSpeed: 1.8 + difficulty * 0.35,
        targetHealth: baseHealth + Math.floor(difficulty / 3),
        spawnIntervalMs: Math.max(550, 1800 - difficulty * 120),
        timeLimitSec: 50 + difficulty * 5,
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
    baseDifficulty = 'medium';
    spawnQueue = 0;
    spawnTimer = 0;
    waveTimer = 0;
    countdownTimer = 0;
    nextWaveTimeoutId = null;
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
            this.clearNextWaveTimeout();
            this.emitter.emit('ui:wave', 0);
            this.emitter.emit('ui:timer', 0);
        });
        this.emitter.on('ui:gameover', () => {
            this.state = 'failed';
            this.clearNextWaveTimeout();
        });
        this.emitter.on('raycast:request_targets', (callback) => {
            callback(this.enemies.flatMap((enemy) => enemy.getRaycastTargets()));
        });
        // When a target is killed, remove it from our tracking list
        this.emitter.on('target:killed', (data) => {
            // Logic to remove enemy from array would go here if using instance tracking
            // For now, we check the length in the update loop
        });
    }
    setBaseDifficulty(level) {
        this.baseDifficulty = level;
    }
    nextWave() {
        this.clearNextWaveTimeout();
        this.currentWave++;
        this.config = buildWaveConfig(this.currentWave, this.baseDifficulty);
        this.state = 'countdown';
        this.countdownTimer = 0;
        this.emitter.emit('wave:start', {
            waveNumber: this.currentWave,
            config: this.config
        });
        this.emitter.emit('ui:wave', this.currentWave);
        this.emitter.emit('ui:timer', this.COUNTDOWN_SEC);
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
        const remaining = Math.max(0, Math.ceil(this.COUNTDOWN_SEC - this.countdownTimer));
        this.emitter.emit('ui:timer', remaining);
        this.emitter.emit('ui:countdown', remaining);
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
        this.emitter.emit('ui:countdown-go');
        this.emitter.emit('ui:timer', this.config.timeLimitSec);
        setTimeout(() => this.emitter.emit('ui:countdown-hide'), 850);
    }
    tickSpawning(delta) {
        this.waveTimer += delta;
        if (this.config) {
            this.emitter.emit('ui:timer', Math.max(0, this.config.timeLimitSec - this.waveTimer));
        }
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
        if (this.config) {
            this.emitter.emit('ui:timer', Math.max(0, this.config.timeLimitSec - this.waveTimer));
        }
        // Check for win condition: all enemies cleared
        if (this.enemies.length === 0 && this.spawnQueue <= 0) {
            this.state = 'complete';
            this.emitter.emit('wave:complete', { waveNumber: this.currentWave });
            // Auto-start next wave after a delay
            this.nextWaveTimeoutId = setTimeout(() => this.nextWave(), 3000);
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
    clearNextWaveTimeout() {
        if (this.nextWaveTimeoutId) {
            clearTimeout(this.nextWaveTimeoutId);
            this.nextWaveTimeoutId = null;
        }
    }
    reset() {
        this.currentWave = 0;
        this.state = 'idle';
        this.spawnQueue = 0;
        this.waveTimer = 0;
        this.clearNextWaveTimeout();
        this.cleanup(); // Deletes all mesh objects from the scene
    }
}
