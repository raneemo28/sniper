import * as THREE from 'three';

export interface TargetOptions {
  position: THREE.Vector3;
  speed: number;
  health: number;
}

export class Target {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  isDead: boolean = false;

  private scene: THREE.Scene;
  private static geometry = new THREE.SphereGeometry(0.4, 12, 12);
  private static material = new THREE.MeshStandardMaterial({ color: 0xe74c3c });

  constructor(scene: THREE.Scene, options: TargetOptions) {
    this.scene = scene;
    this.health = options.health;
    this.maxHealth = options.health;

    this.mesh = new THREE.Mesh(Target.geometry, Target.material.clone());
    this.mesh.position.copy(options.position);
    this.mesh.castShadow = true;

    const angle = Math.random() * Math.PI * 2;
    this.velocity = new THREE.Vector3(
      Math.cos(angle) * options.speed,
      0,
      Math.sin(angle) * options.speed,
    );

    scene.add(this.mesh);
  }

  update(delta: number): void {
    if (this.isDead) return;
    this.mesh.position.addScaledVector(this.velocity, delta);
    this.bounceOnBoundary(9); 
  }

  hit(): boolean {
    this.health--;
    this.flashOnHit();
    if (this.health <= 0) {
      this.isDead = true;
      return true; 
    }
    return false;
  }

  destroy(): void {
    this.isDead = true;
    this.scene.remove(this.mesh);
    (this.mesh.material as THREE.Material).dispose();
  }

  private bounceOnBoundary(limit: number): void {
    if (Math.abs(this.mesh.position.x) > limit) this.velocity.x *= -1;
    if (Math.abs(this.mesh.position.z) > limit) this.velocity.z *= -1;
  }

  private flashOnHit(): void {
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    const original = mat.color.getHex();
    mat.color.setHex(0xffffff);
    setTimeout(() => mat.color.setHex(original), 80);
  }
}
