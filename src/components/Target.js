import * as THREE from 'three';
export class Target {
    mesh;
    velocity;
    health;
    maxHealth;
    isDead = false;
    scene;
    static geometry = new THREE.SphereGeometry(0.4, 12, 12);
    static material = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
    constructor(scene, options) {
        this.scene = scene;
        this.health = options.health;
        this.maxHealth = options.health;
        this.mesh = new THREE.Mesh(Target.geometry, Target.material.clone());
        this.mesh.position.copy(options.position);
        this.mesh.castShadow = true;
        const angle = Math.random() * Math.PI * 2;
        this.velocity = new THREE.Vector3(Math.cos(angle) * options.speed, 0, Math.sin(angle) * options.speed);
        scene.add(this.mesh);
    }
    update(delta) {
        if (this.isDead)
            return;
        this.mesh.position.addScaledVector(this.velocity, delta);
        this.bounceOnBoundary(9);
    }
    hit() {
        this.health--;
        this.flashOnHit();
        if (this.health <= 0) {
            this.isDead = true;
            return true;
        }
        return false;
    }
    destroy() {
        this.isDead = true;
        this.scene.remove(this.mesh);
        this.mesh.material.dispose();
    }
    bounceOnBoundary(limit) {
        if (Math.abs(this.mesh.position.x) > limit)
            this.velocity.x *= -1;
        if (Math.abs(this.mesh.position.z) > limit)
            this.velocity.z *= -1;
    }
    flashOnHit() {
        const mat = this.mesh.material;
        const original = mat.color.getHex();
        mat.color.setHex(0xffffff);
        setTimeout(() => mat.color.setHex(original), 80);
    }
}
