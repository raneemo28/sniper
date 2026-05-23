import * as THREE from 'three';
import { EventEmitter } from './utils/EventEmitter';
import { WaveSystem } from './systems/WaveSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { RaycastSystem } from './systems/RaycastSystem';
import { CameraSystem } from './systems/CameraSystem';
import { InputHandler } from './systems/InputHandler';
import { GameScene } from './scenes/GameScene';
import { Player } from './components/Player';
import { UIScene } from './scenes/UIScene';
export class Game {
    renderer;
    clock;
    emitter;
    // Systems
    gameScene;
    player;
    inputHandler;
    waveSystem;
    raycastSystem;
    scoreSystem;
    cameraSystem;
    uiScene;
    MAX_HEALTH = 10;
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);
        this.clock = new THREE.Clock();
        this.emitter = new EventEmitter();
        // 1. Build scene
        this.gameScene = new GameScene();
        // 2. Instantiate Player (other systems depend on this instance)
        this.player = new Player(this.gameScene.scene, this.emitter);
        // 3. Instantiate Systems
        this.inputHandler = new InputHandler(this.emitter);
        this.cameraSystem = new CameraSystem(this.gameScene.camera, this.player, this.emitter);
        // FIX: Correct argument order (Scene, Position, Emitter)
        this.waveSystem = new WaveSystem(this.gameScene.scene, this.player.position, this.emitter);
        this.raycastSystem = new RaycastSystem(this.gameScene.camera, this.player, this.emitter);
        this.scoreSystem = new ScoreSystem(this.emitter);
        this.uiScene = new UIScene(this.emitter);
        this.setupEventListeners();
        window.addEventListener('resize', () => this.onResize());
    }
    setupEventListeners() {
        // Player Combat Logic
        this.emitter.on('player:hit', (data) => {
            const damage = data?.damage || 1;
            this.player.takeDamage(damage);
            const healthPct = (this.player.health / 100) * 100;
            this.emitter.emit('ui:playerhit', healthPct);
            if (this.player.health <= 0) {
                this.onGameOver();
            }
        });
        // Wire bullet tracer trails (player shots — Neon Cyan)
        this.emitter.on('visual:tracer', ({ origin, target, color }) => {
            this.gameScene.createTracer(origin, target, color);
        });
        // Wire game-over events
        this.emitter.on('ui:gameover', () => this.onGameOver());
        // Wire game-reset: restart game loop, reset player and waves
        this.emitter.on('game:reset', () => {
            this.resetGame();
        });
    }
    start() {
        this.emitter.emit('game:start');
        this.renderer.setAnimationLoop(() => this.tick());
    }
    resetGame() {
        this.clock.getDelta();
        this.player.health = this.MAX_HEALTH;
        // Reset all sub-systems
        this.player.reset();
        this.waveSystem.reset(); // Requires the reset() method added to WaveSystem
        this.raycastSystem.reset();
        // Start fresh
        this.emitter.emit('game:start');
        this.renderer.setAnimationLoop(() => this.tick());
    }
    tick() {
        const delta = this.clock.getDelta();
        // Update all systems in logical order
        this.inputHandler.update();
        this.player.update(delta, this.cameraSystem.cameraYaw);
        this.waveSystem.update(delta);
        this.raycastSystem.update();
        this.cameraSystem.update(delta);
        // Render frame
        this.renderer.render(this.gameScene.scene, this.gameScene.camera);
    }
    onGameOver() {
        // Stop the loop
        this.renderer.setAnimationLoop(null);
        // Show the Game Over screen via UI System
        this.emitter.on('ui:gameover', () => {
            this.onGameOver();
        });
    }
    onResize() {
        const { innerWidth: w, innerHeight: h } = window;
        this.gameScene.camera.aspect = w / h;
        this.gameScene.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}
