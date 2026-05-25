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

    // FIX BUG 7: Match player's actual starting health
    MAX_HEALTH = 100;

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
        this.waveSystem = new WaveSystem(this.gameScene.scene, this.player.position, this.emitter);
        this.raycastSystem = new RaycastSystem(this.gameScene.camera, this.player, this.emitter);
        this.scoreSystem = new ScoreSystem(this.emitter);
        this.uiScene = new UIScene(this.emitter);

        this.setupEventListeners();
        window.addEventListener('resize', () => this.onResize());
    }

    setupEventListeners() {
        // FIX BUG 1: Read data.amount (what Enemy actually sends), not data.damage
        this.emitter.on('player:hit', (data) => {
            const damage = data?.amount || 1;
            this.player.takeDamage(damage);
            const healthPct = (this.player.health / this.MAX_HEALTH) * 100;
            // Trigger the HUD health bar + blur
            this.emitter.emit('ui:playerhit', healthPct);
            // Also update the standard health bar
            this.emitter.emit('ui:health', { current: this.player.health, max: this.MAX_HEALTH });
            if (this.player.health <= 0) {
                this.onGameOver();
            }
        });

        // Wire bullet tracer trails
        this.emitter.on('visual:tracer', ({ origin, target, color }) => {
            this.gameScene.createTracer(origin, target, color);
        });

        // FIX BUG 5: Wire camera:shake to CameraSystem
        this.emitter.on('camera:shake', (intensity) => {
            this.cameraSystem.triggerShake(intensity || 0.15);
        });

        // FIX BUG 2: Wire game-over properly — listen once and emit to UI with snapshot
        this.emitter.on('ui:gameover', () => {
            this.onGameOver();
        });

        // Wire game-reset
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
        this.player.reset();
        this.waveSystem.reset();
        this.raycastSystem.reset();
        this.emitter.emit('ui:health', { current: this.MAX_HEALTH, max: this.MAX_HEALTH });
        this.emitter.emit('game:start');
        this.renderer.setAnimationLoop(() => this.tick());
    }

    tick() {
        const delta = this.clock.getDelta();
        this.inputHandler.update();
        this.player.update(delta, this.cameraSystem.cameraYaw);
        this.waveSystem.update(delta);
        this.raycastSystem.update();
        this.cameraSystem.update(delta);
        this.renderer.render(this.gameScene.scene, this.gameScene.camera);
    }

    onGameOver() {
        // Stop the loop
        this.renderer.setAnimationLoop(null);

        // FIX BUG 2: Collect score snapshot and pass it to UIScene
        const snap = this.scoreSystem.snapshot();
        this.uiScene.showGameOver(snap);
    }

    onResize() {
        const { innerWidth: w, innerHeight: h } = window;
        this.gameScene.camera.aspect = w / h;
        this.gameScene.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}
