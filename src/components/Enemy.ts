import * as THREE from 'three';
import { loadModel } from '../utils/loader';
import { EventEmitter } from '../utils/EventEmitter';

export class Enemy {
  mesh: THREE.Group | null = null;
  position: THREE.Vector3;
  
  private scene: THREE.Scene;
  private emitter: EventEmitter;
  private playerPos: THREE.Vector3; 
  
  // Stats & Combat
  private health: number;
  private maxHealth: number;
  private speed: number;
  private isDead = false;

  private wanderTimer: number = 0;
  private wanderDirection: THREE.Vector3 = new THREE.Vector3();
  private readonly boundaryLimit = 19;

  private shootTimer: number = 0;
  private readonly SHOOT_INTERVAL = 3.0;
  
  // Health Bar UI
  private healthBarBackground: THREE.Mesh | null = null;
  private healthBarForeground: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, startPos: THREE.Vector3, playerPos: THREE.Vector3, emitter: EventEmitter, health = 3, speed = 4.0) {
    this.scene = scene;
    this.emitter = emitter;
    this.position = startPos;
    this.playerPos = playerPos;
    
    this.maxHealth = health;
    this.health = health;
    this.speed = speed; // "Runner" speed typically 4.0+, wanderer was 2.0

    this.init();
  }

  private async init() {
  this.mesh = await loadModel('/src/models/SWAT.glb');
  this.mesh.position.copy(this.position);
  
  this.mesh.userData.instance = this; 

  this.scene.add(this.mesh);
  this.createHealthBar();
}

  private createHealthBar() {
    const geometry = new THREE.PlaneGeometry(1, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const fgMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    this.healthBarBackground = new THREE.Mesh(geometry, bgMat);
    this.healthBarForeground = new THREE.Mesh(geometry, fgMat);

    // Position above the enemy head
    this.healthBarBackground.position.set(0, 2.2, 0);
    this.healthBarForeground.position.set(0, 2.2, 0.01); // Slightly in front to prevent z-fighting

    this.mesh?.add(this.healthBarBackground);
    this.mesh?.add(this.healthBarForeground);
  }

  update(delta: number) {
    if (!this.mesh || this.isDead) return;

    // 1. Movement: Wander randomly
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 1 + Math.random() * 2;
      this.wanderDirection.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize();
    }
    
    this.position.addScaledVector(this.wanderDirection, this.speed * delta);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -this.boundaryLimit, this.boundaryLimit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -this.boundaryLimit, this.boundaryLimit);
    
    this.mesh.position.copy(this.position);
    
    // Smoothly look in movement direction
    const targetRotation = new THREE.Matrix4().lookAt(
      this.position, 
      this.position.clone().add(this.wanderDirection), 
      new THREE.Vector3(0, 1, 0)
    );
    this.mesh.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(targetRotation), 0.1);

    // 2. Health Bar: Always face the camera (Billboarding)
    if (this.healthBarBackground) {
        this.healthBarBackground.quaternion.copy(this.scene.getObjectByName('MainCamera')?.quaternion || new THREE.Quaternion());
        this.healthBarForeground?.quaternion.copy(this.healthBarBackground.quaternion);
    }

    // 3. Shooting logic
    this.shootTimer -= delta;
    if (this.shootTimer <= 0) {
      this.shootAtPlayer();
      this.shootTimer = this.SHOOT_INTERVAL;
    }
  }

  public takeDamage(amount: number) {
    if (this.isDead) return;

    this.health -= amount;
    this.updateHealthBar(); 
    if (this.health <= 0) {
      this.die();
    }
  }

  private updateHealthBar() {
    if (this.healthBarForeground) {
      const scale = Math.max(0, this.health / this.maxHealth);
      this.healthBarForeground.scale.set(scale, 1, 1);
      this.healthBarForeground.position.x = (scale - 1) * 0.5;
    }
  }

  private shootAtPlayer() {
  const distance = this.position.distanceTo(this.playerPos);
  
  // Only shoot if player is within range (25 units)
  if (distance < 25 && !this.isDead) {
    // 1. Logic for "Target Shooting Back"
    this.emitter.emit('player:hit', { 
      amount: 1, 
      direction: this.position.clone().sub(this.playerPos).normalize() 
    });

    // 2. Visual Feedback
    this.emitter.emit('camera:shake', 0.15);
    this.emitter.emit('ui:hitblur'); // Triggers the screen blur in UIScene
    
    // 3. Simple Tracer from Enemy to Player
    this.emitter.emit('visual:tracer', {
      origin: this.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
      target: this.playerPos.clone().add(new THREE.Vector3(0, 1.5, 0)),
      color: 0xff3300 // Red hostile tracer
    });
  }
  }
  private die() {
    this.isDead = true;
    this.emitter.emit('target:killed', { position: this.position.clone() });
    
    // Simple fade out or immediate removal
    this.scene.remove(this.mesh!);
  }

  destroy() {
    if (this.mesh) this.scene.remove(this.mesh);
  }
}