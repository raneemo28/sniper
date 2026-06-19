import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EventEmitter } from '../utils/EventEmitter';

export class Player {
  mesh: THREE.Group | null = null;
  readonly position = new THREE.Vector3(0, 0, 0);
  
  private scene: THREE.Scene;
  private emitter: EventEmitter;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private keys: Record<string, boolean> = {};
  private wasMoving = false;
  
  // Stats & Combat
  public health = 100;
  private readonly maxHealth = 100;
  private readonly speed = 6.5; 
  private readonly scale = 1.8; 
  private readonly boundaryLimit = 19; 

  constructor(scene: THREE.Scene, emitter: EventEmitter) {
    this.scene = scene;
    this.emitter = emitter;
    this.loadModel();
    
    // Subscribe to keyboard inputs from the InputHandler
    this.emitter.on('input:keys', (keys: Record<string, boolean>) => {
      this.keys = keys;
    });
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/src/models/CesiumMan.glb',
      (gltf) => {
        this.mesh = gltf.scene;
        this.mesh.scale.set(this.scale, this.scale, this.scale);
        this.mesh.position.copy(this.position);
        
        // Enable shadows for the character
        this.mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Rotate the model by 180 degrees initially so he faces forward
        this.mesh.rotation.y = Math.PI;

        this.scene.add(this.mesh);
        console.log('[Player] Loaded animations:', gltf.animations);

        // Setup walking animations using the mixer
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.mesh);
          this.walkAction = this.mixer.clipAction(gltf.animations[0]);
          this.walkAction.timeScale = 1.35;
          this.walkAction.play();
          this.walkAction.paused = true; // Start in standing/idle state
        }
      },
      undefined,
      (error) => {
        console.error('[Player] Failed to load model:', error);
      }
    );
  }

  update(delta: number, cameraYaw: number): void {
    if (!this.mesh) return;

    const moveDirection = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw).normalize();

    // Support for WASD and Arrow Keys
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDirection.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDirection.add(forward.clone().negate());
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDirection.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDirection.add(right.clone().negate());

    const isMoving = moveDirection.lengthSq() > 0;
    this.setMoving(isMoving);

    if (isMoving) {
      moveDirection.normalize();
      this.position.addScaledVector(moveDirection, this.speed * delta);
      
      // Keep player inside rooftop boundaries
      this.position.x = THREE.MathUtils.clamp(this.position.x, -this.boundaryLimit, this.boundaryLimit);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -this.boundaryLimit, this.boundaryLimit);
      
      this.mesh.position.copy(this.position);

      // Smooth turning adjustment
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
      let diff = targetAngle - this.mesh.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.mesh.rotation.y += diff * 12 * delta;
      
      // FIX: Clean, direct unpausing sequence
      if (this.walkAction) {
        this.walkAction.paused = false;
      }
    } else {
      // Stand still completely
      if (this.walkAction) {
        this.walkAction.paused = true;
      }
    }

    // Unconditionally advance the animation mixer frame
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.emitter.emit('ui:gameover'); 
    }
  }

  getShootingOrigin(): THREE.Vector3 {
    return this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  }

  reset(): void {
    this.health = this.maxHealth;
    this.position.set(0, 0, 0);
    this.setMoving(false);
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = Math.PI;
    }
    if (this.walkAction) {
      this.walkAction.stop();
      this.walkAction.play();
      this.walkAction.paused = true;
    }
  }

  getFacingDirection(): THREE.Vector3 {
    if (!this.mesh) return new THREE.Vector3(0, 0, -1);
    const localFront = new THREE.Vector3(0, 0, 1);
    return localFront.applyQuaternion(this.mesh.quaternion).normalize();
  }

  destroy(): void {
    this.setMoving(false);
    if (this.mesh) this.scene.remove(this.mesh);
  }

  private setMoving(isMoving: boolean): void {
    if (this.wasMoving === isMoving) return;

    this.wasMoving = isMoving;
    this.emitter.emit('player:moving', isMoving);
  }
}
