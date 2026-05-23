import * as THREE from 'three';
import { Target } from '../components/Target';
function buildWaveConfig(waveNumber) {
    return {
        waveNumber,
        targetCount: 3 + waveNumber * 2,
        targetSpeed: 1.5 + waveNumber * 0.4,
        targetHealth: waveNumber < 3 ? 1 : Math.ceil(waveNumber / 3),
        spawnIntervalMs: Math.max(400, 1200 - waveNumber * 100),
        timeLimitSec: 40 + waveNumber * 5,
    };
}
export class WaveSystem {
    emitter;
    scene;
    state = 'idle';
    currentWave = 0;
    config = null;
    activeTargets = new Set();
    spawnQueue = 0;
    spawnTimer = 0;
    waveTimer = 0;
    countdownTimer = 0;
    COUNTDOWN_SEC = 3;
    constructor(scene, emitter) {
        this.scene = scene;
        this.emitter = emitter;
        this.emitter.on('target:killed', (target) => {
            this.handleTargetKilled(target);
        });
    }
    // ---------------------------------------------------------------------------
    // Public API — called by Game facade
    // ---------------------------------------------------------------------------
    /** Begin the first wave. Call once after scene is ready. */
    start() {
        this.beginCountdown(1);
    }
    /** Called every frame by Game.update(). delta = seconds since last frame. */
    update(delta) {
        // Update all active targets so they move in the scene
        this.activeTargets.forEach(t => t.update(delta));
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
            default: break;
        }
    }
    /** Restart — resets all state, used by GameOverSystem. */
    reset() {
        this.activeTargets.forEach(t => t.destroy());
        this.activeTargets.clear();
        this.currentWave = 0;
        this.state = 'idle';
        this.config = null;
    }
    // Expose read-only state for HUD
    get waveNumber() { return this.currentWave; }
    get timeRemaining() {
        if (!this.config)
            return 0;
        return Math.max(0, this.config.timeLimitSec - this.waveTimer);
    }
    get countdown() { return Math.ceil(this.COUNTDOWN_SEC - this.countdownTimer); }
    get waveState() { return this.state; }
    // ---------------------------------------------------------------------------
    // State transitions
    // ---------------------------------------------------------------------------
    beginCountdown(waveNumber) {
        this.currentWave = waveNumber;
        this.config = buildWaveConfig(waveNumber);
        this.countdownTimer = 0;
        this.state = 'countdown';
        this.emitter.emit('wave:countdown', {
            waveNumber,
            config: this.config,
        });
    }
    beginSpawning() {
        if (!this.config)
            return;
        this.spawnQueue = this.config.targetCount;
        this.spawnTimer = this.config.spawnIntervalMs; // spawn first target immediately
        this.waveTimer = 0;
        this.state = 'spawning';
        this.emitter.emit('wave:start', {
            waveNumber: this.currentWave,
            config: this.config,
        });
    }
    completeWave() {
        this.state = 'complete';
        this.emitter.emit('wave:complete', { waveNumber: this.currentWave });
        // Short pause then auto-advance
        setTimeout(() => this.beginCountdown(this.currentWave + 1), 2000);
    }
    failWave() {
        this.state = 'failed';
        this.activeTargets.forEach(t => t.destroy());
        this.activeTargets.clear();
        this.emitter.emit('wave:failed', { waveNumber: this.currentWave });
        // Game facade listens to wave:failed and triggers GameOverSystem
    }
    // ---------------------------------------------------------------------------
    // Per-state tick logic
    // ---------------------------------------------------------------------------
    tickCountdown(delta) {
        this.countdownTimer += delta;
        this.emitter.emit('wave:countdown:tick', this.countdown);
        if (this.countdownTimer >= this.COUNTDOWN_SEC) {
            this.beginSpawning();
        }
    }
    tickSpawning(delta) {
        if (!this.config)
            return;
        this.waveTimer += delta;
        this.spawnTimer += delta * 1000; // convert to ms
        // Spawn next target if interval elapsed and queue not empty
        if (this.spawnTimer >= this.config.spawnIntervalMs && this.spawnQueue > 0) {
            this.spawnTarget();
            this.spawnQueue--;
            this.spawnTimer = 0;
        }
        // Once all spawned, move to active (time-limit) monitoring
        if (this.spawnQueue <= 0) {
            this.state = 'active';
        }
        this.checkTimeLimitFail();
    }
    tickActive(delta) {
        this.waveTimer += delta;
        this.checkTimeLimitFail();
        // All targets cleared — wave complete
        if (this.activeTargets.size === 0) {
            this.completeWave();
        }
    }
    checkTimeLimitFail() {
        if (!this.config)
            return;
        if (this.waveTimer >= this.config.timeLimitSec) {
            this.failWave();
        }
    }
    // ---------------------------------------------------------------------------
    // Spawning
    // ---------------------------------------------------------------------------
    spawnTarget() {
        if (!this.config)
            return;
        const position = this.randomSpawnPosition();
        const target = new Target(this.scene, {
            position,
            speed: this.config.targetSpeed,
            health: this.config.targetHealth,
        });
        this.activeTargets.add(target);
        this.emitter.emit('target:spawned', target);
    }
    /** Spawn on the rooftop perimeter, always visible from the player position */
    randomSpawnPosition() {
        const edge = Math.floor(Math.random() * 4);
        const spread = 18;
        const x = (Math.random() - 0.5) * spread;
        const z = (Math.random() - 0.5) * spread;
        // Place on one of four rooftop edges
        switch (edge) {
            case 0: return new THREE.Vector3(spread / 2, 0, z);
            case 1: return new THREE.Vector3(-spread / 2, 0, z);
            case 2: return new THREE.Vector3(x, 0, spread / 2);
            case 3: return new THREE.Vector3(x, 0, -spread / 2);
            default: return new THREE.Vector3(0, 0, 0);
        }
    }
    // ---------------------------------------------------------------------------
    // Event handlers
    // ---------------------------------------------------------------------------
    handleTargetKilled(target) {
        if (!this.activeTargets.has(target))
            return;
        target.destroy();
        this.activeTargets.delete(target);
        // ScoreSystem listens to target:killed independently — WaveSystem
        // does not touch the score. Clean separation of concerns.
    }
}
