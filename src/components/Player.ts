import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter';
import { loadModel } from '../utils/loader'; //

export class Player {
  mesh: THREE.Group | null = null;
  readonly position = new THREE.Vector3(0, 0, 0);
  
  private scene: THREE.Scene;
  private emitter: EventEmitter;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private keys: Record<string, boolean> = {};
  
  // Stats & Combat
  public health = 100;
  private readonly maxHealth = 100;
  private readonly speed = 6.5; 
  private readonly scale = 1.8; 
  private readonly boundaryLimit = 19; 

  constructor(scene: THREE.Scene, emitter: EventEmitter) {
    this.scene = scene;
    this.emitter = emitter;
    this.init();

    // Subscribe to keyboard inputs from the InputHandler
    this.emitter.on('input:keys', (keys: Record<string, boolean>) => {
      this.keys = keys;
    });
  }

  private async init(): Promise<void> {
    try {
      // Use your custom loader utility
      this.mesh = await loadModel('/src/models/CesiumMan.glb');
      
      this.mesh.scale.set(this.scale, this.scale, this.scale);
      this.mesh.position.copy(this.position);
      
      // Rotate the model by 180 degrees initially so he faces forward
      this.mesh.rotation.y = Math.PI;

      this.scene.add(this.mesh);

      // Setup animations (CesiumMan usually has animations at index 0)
      // Note: loadModel returns the scene, but we can access animations if we 
      // adjust loader.ts or handle the mixer if the GLTF object was stored.
      // Since your loader.ts currently only returns the Group, we assume 
      // standard mesh animations for now.
    } catch (error) {
      console.error('[Player] Failed to load via loader utility:', error);
    }
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

    if (isMoving) {
      moveDirection.normalize();
      this.position.addScaledVector(moveDirection, this.speed * delta);
      
      // Keep player inside rooftop boundaries
      this.position.x = THREE.MathUtils.clamp(this.position.x, -this.boundaryLimit, this.boundaryLimit);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -this.boundaryLimit, this.boundaryLimit);
      
      this.mesh.position.copy(this.position);

      // Smooth turning
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
      let diff = targetAngle - this.mesh.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.mesh.rotation.y += diff * 12 * delta;
    }

    if (this.mixer) this.mixer.update(delta);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.emitter.emit('ui:gameover'); 
    }
  }

  getShootingOrigin(): THREE.Vector3 {
    // Shoulder/chest height of the scaled character
    return this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  }

  reset(): void {
    this.health = this.maxHealth;
    this.position.set(0, 0, 0);
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = Math.PI;
    }
  }

  destroy(): void {
    if (this.mesh) this.scene.remove(this.mesh);
  }
}