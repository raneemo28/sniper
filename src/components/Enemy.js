import * as THREE from 'three';
import { loadModel } from '../utils/loader';
export class Enemy {
    mesh = null;
    position;
    scene;
    emitter;
    playerPos;
    // Stats & Combat
    health;
    maxHealth;
    speed;
    isDead = false;
    wanderTimer = 0;
    wanderDirection = new THREE.Vector3();
    boundaryLimit = 19;
    shootTimer = 0;
    SHOOT_INTERVAL = 3.0;
    // Health Bar UI
    healthBarBackground = null;
    healthBarForeground = null;
    hitbox = null;
    constructor(scene, startPos, playerPos, emitter, health = 5, speed = 4.0) {
        this.scene = scene;
        this.emitter = emitter;
        this.position = startPos;
        this.playerPos = playerPos;
        this.maxHealth = health;
        this.health = health;
        this.speed = speed; // "Runner" speed typically 4.0+, wanderer was 2.0
        this.init();
    }
    async init() {
        this.mesh = await loadModel('/src/models/SWAT.glb');
        this.mesh.position.copy(this.position);
        this.mesh.userData.instance = this;
        this.mesh.traverse((child) => {
            child.userData.instance = this;
        });
        this.scene.add(this.mesh);
        this.createHitbox();
        this.createHealthBar();
    }
    createHitbox() {
        if (!this.mesh)
            return;
        const geometry = new THREE.BoxGeometry(1.5, 2.4, 1.5);
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        this.hitbox = new THREE.Mesh(geometry, material);
        this.hitbox.position.set(0, 1.2, 0);
        this.hitbox.userData.instance = this;
        this.mesh.add(this.hitbox);
    }
    createHealthBar() {
        const geometry = new THREE.PlaneGeometry(1, 0.12);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        const fgMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.healthBarBackground = new THREE.Mesh(geometry, bgMat);
        this.healthBarForeground = new THREE.Mesh(geometry, fgMat);
        this.healthBarBackground.userData.instance = this;
        this.healthBarForeground.userData.instance = this;
        // Position above the enemy head
        this.healthBarBackground.position.set(0, 2.2, 0);
        this.healthBarForeground.position.set(0, 2.2, 0.01); // Slightly in front to prevent z-fighting
        this.mesh?.add(this.healthBarBackground);
        this.mesh?.add(this.healthBarForeground);
    }
    update(delta) {
        if (!this.mesh || this.isDead)
            return;
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
        const targetRotation = new THREE.Matrix4().lookAt(this.position, this.position.clone().add(this.wanderDirection), new THREE.Vector3(0, 1, 0));
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
    takeDamage(amount) {
        if (this.isDead)
            return;
        this.health -= amount;
        this.updateHealthBar();
        if (this.health <= 0) {
            this.die();
        }
        else {
            this.emitter.emit('target:hit', { position: this.position.clone() });
        }
    }
    updateHealthBar() {
        if (this.healthBarForeground) {
            const scale = Math.max(0, this.health / this.maxHealth);
            this.healthBarForeground.scale.set(scale, 1, 1);
            this.healthBarForeground.position.x = (scale - 1) * 0.5;
        }
    }
    shootAtPlayer() {
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
    die() {
        this.isDead = true;
        this.emitter.emit('target:killed', { position: this.position.clone() });
        // Simple fade out or immediate removal
        this.scene.remove(this.mesh);
    }
    destroy() {
        if (this.mesh)
            this.scene.remove(this.mesh);
    }
    getRaycastTargets() {
        return this.mesh && !this.isDead ? [this.mesh] : [];
    }
}
