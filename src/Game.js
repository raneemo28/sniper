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
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        this.clock = new THREE.Clock();
        this.emitter = new EventEmitter();
        // Build scene first 
        this.gameScene = new GameScene();
        // Instantiate Player first, as other systems depend on it
        this.player = new Player(this.gameScene.scene, this.emitter);
        // Instantiate systems — each gets the emitter, none imports another
        this.inputHandler = new InputHandler(this.emitter);
        this.cameraSystem = new CameraSystem(this.gameScene.camera, this.player, this.emitter);
        this.waveSystem = new WaveSystem(this.gameScene.scene, this.emitter);
        this.raycastSystem = new RaycastSystem(this.gameScene.camera, this.player, this.emitter);
        this.scoreSystem = new ScoreSystem(this.emitter);
        this.uiScene = new UIScene(this.emitter);
        // Wire game-over: wave failure → stop loop, show screen
        this.emitter.on('wave:failed', () => this.onGameOver());
        // Wire bullet tracer trails
        this.emitter.on('shot:tracer', ({ origin, target }) => {
            this.gameScene.createTracer(origin, target);
        });
        // Wire game-reset: restart dev loop, reset player and waves
        this.emitter.on('game:reset', () => {
            this.player.reset();
            this.waveSystem.reset();
            this.waveSystem.start();
            this.renderer.setAnimationLoop(() => this.tick());
        });
        window.addEventListener('resize', () => this.onResize());
    }
    start() {
        this.waveSystem.start();
        this.renderer.setAnimationLoop(() => this.tick());
    }
    tick() {
        const delta = this.clock.getDelta();
        this.inputHandler.update();
        // Update player movement and animation state
        this.player.update(delta, this.cameraSystem.cameraYaw);
        this.waveSystem.update(delta);
        this.raycastSystem.update();
        this.cameraSystem.update(delta);
        this.renderer.render(this.gameScene.scene, this.gameScene.camera);
    }
    onGameOver() {
        this.renderer.setAnimationLoop(null);
        this.emitter.emit('ui:gameover', {
            score: this.scoreSystem.score,
            wave: this.waveSystem.waveNumber,
        });
    }
    onResize() {
        const { innerWidth: w, innerHeight: h } = window;
        this.gameScene.camera.aspect = w / h;
        this.gameScene.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}
