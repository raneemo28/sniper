import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter';
import { Enemy } from '../components/Enemy';

export interface WaveConfig {
  waveNumber: number;
  targetCount: number;
  targetSpeed: number;
  targetHealth: number;
  spawnIntervalMs: number;
  timeLimitSec: number;
}

/**
 * Generates wave difficulty. 
 * targetSpeed and targetHealth are passed to the Enemy class.
 */
function buildWaveConfig(waveNumber: number): WaveConfig {
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

type WaveState = 'idle' | 'countdown' | 'spawning' | 'active' | 'complete' | 'failed';

export class WaveSystem {
  private emitter: EventEmitter;
  private scene: THREE.Scene;
  private playerPos: THREE.Vector3;
  private enemies: Enemy[] = []; 

  private state: WaveState = 'idle';
  private currentWave = 0;
  private config: WaveConfig | null = null;

  private spawnQueue: number = 0;
  private spawnTimer: number = 0;
  private waveTimer: number = 0;
  private countdownTimer: number = 0;
  private readonly COUNTDOWN_SEC = 3;

  constructor(scene: THREE.Scene, playerPos: THREE.Vector3, emitter: EventEmitter) {
    this.scene = scene;
    this.playerPos = playerPos;
    this.emitter = emitter;

    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    // Start next wave when UI/Game requests
    this.emitter.on('game:start', () => this.nextWave());
    this.emitter.on('game:reset', () => {
      this.currentWave = 0;
      this.cleanup();
      this.state = 'idle';
    });

    // When a target is killed, remove it from our tracking list
    this.emitter.on('target:killed', (data: { position: THREE.Vector3 }) => {
      // Logic to remove enemy from array would go here if using instance tracking
      // For now, we check the length in the update loop
    });
  }

  public nextWave(): void {
    this.currentWave++;
    this.config = buildWaveConfig(this.currentWave);
    this.state = 'countdown';
    this.countdownTimer = 0;
    
    this.emitter.emit('wave:start', { 
      waveNumber: this.currentWave, 
      config: this.config 
    });
  }

  update(delta: number): void {
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

  private tickCountdown(delta: number): void {
    this.countdownTimer += delta;
    if (this.countdownTimer >= this.COUNTDOWN_SEC) {
      this.beginSpawning();
    }
  }

  private beginSpawning(): void {
    if (!this.config) return;
    this.state = 'spawning';
    this.spawnQueue = this.config.targetCount;
    this.spawnTimer = 0;
    this.waveTimer = 0;
  }

  private tickSpawning(delta: number): void {
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

  private tickActive(delta: number): void {
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

  private spawnTarget(): void {
    if (!this.config) return;
    
    const position = this.randomSpawnPosition();

    // FIX: Pass all required arguments to the Enemy constructor
    const enemy = new Enemy(
      this.scene, 
      position, 
      this.playerPos, 
      this.emitter, 
      this.config.targetHealth, 
      this.config.targetSpeed
    );

    this.enemies.push(enemy);
  }

  private randomSpawnPosition(): THREE.Vector3 {
    const spread = 38; // Slightly inside the 40x40 rooftop
    const x = (Math.random() - 0.5) * spread;
    const z = (Math.random() - 0.5) * spread;
    return new THREE.Vector3(x, 0, z);
  }

  private cleanup(): void {
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
  }
  public reset(): void {
  this.currentWave = 0;
  this.state = 'idle';
  this.spawnQueue = 0;
  this.waveTimer = 0;
  this.cleanup(); // Deletes all mesh objects from the scene
  }
}