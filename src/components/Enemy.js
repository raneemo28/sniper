import * as THREE from 'three';

/**
 * Enemy — Procedural "Runner" humanoid mesh built from Three.js primitives.
 * No external GLB needed. All child meshes store userData.instance = this
 * so the RaycastSystem can always find and damage the right Enemy.
 */
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
    // Randomise shoot interval per enemy to avoid synced volleys
    SHOOT_INTERVAL = 2.5 + Math.random() * 1.5;
    // Health Bar UI
    healthBarBackground = null;
    healthBarForeground = null;
    // Animation
    legPhase = Math.random() * Math.PI * 2;
    armPhase = Math.random() * Math.PI * 2;
    leftLeg = null;
    rightLeg = null;
    leftArm = null;
    rightArm = null;

    constructor(scene, startPos, playerPos, emitter, health = 3, speed = 4.0) {
        this.scene = scene;
        this.emitter = emitter;
        this.position = startPos.clone();
        this.playerPos = playerPos;
        this.maxHealth = health;
        this.health = health;
        this.speed = speed;
        this.init();
    }

    /**
     * Builds a procedural humanoid from capsules/boxes.
     * Returns a THREE.Group with userData.instance = this on every child mesh.
     */
    buildRunnerMesh() {
        const group = new THREE.Group();

        // Color palette — menacing red/orange runner
        const skinColor = 0xcc2200;
        const suitColor = 0x1a0a00;
        const accentColor = 0xff4400;

        const mat = (color, emissive = 0x000000) => new THREE.MeshStandardMaterial({
            color,
            emissive,
            emissiveIntensity: emissive !== 0x000000 ? 0.4 : 0,
            roughness: 0.7,
            metalness: 0.1,
        });

        const tag = (mesh) => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // CRITICAL: Store enemy instance reference on every child mesh
            // so RaycastSystem.castRay() can call takeDamage() on the right enemy
            mesh.userData.instance = this;
            return mesh;
        };

        // Body (torso)
        const torso = tag(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.22, 0.55, 4, 8),
            mat(suitColor)
        ));
        torso.position.y = 0.95;
        group.add(torso);

        // Chest accent stripe
        const stripe = tag(new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.08, 0.05),
            mat(accentColor, accentColor)
        ));
        stripe.position.set(0, 1.05, 0.23);
        group.add(stripe);

        // Head
        const head = tag(new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 8),
            mat(skinColor)
        ));
        head.position.y = 1.6;
        group.add(head);

        // Visor (glowing orange slit)
        const visor = tag(new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.06, 0.05),
            mat(accentColor, accentColor)
        ));
        visor.position.set(0, 1.63, 0.17);
        group.add(visor);

        // Left arm
        const leftArm = new THREE.Group();
        leftArm.position.set(-0.32, 1.1, 0);
        const lArmMesh = tag(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.08, 0.45, 4, 8),
            mat(suitColor)
        ));
        lArmMesh.rotation.z = 0.3;
        leftArm.add(lArmMesh);
        group.add(leftArm);
        this.leftArm = leftArm;

        // Right arm
        const rightArm = new THREE.Group();
        rightArm.position.set(0.32, 1.1, 0);
        const rArmMesh = tag(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.08, 0.45, 4, 8),
            mat(suitColor)
        ));
        rArmMesh.rotation.z = -0.3;
        rightArm.add(rArmMesh);
        group.add(rightArm);
        this.rightArm = rightArm;

        // Left leg
        const leftLeg = new THREE.Group();
        leftLeg.position.set(-0.14, 0.55, 0);
        const lLegMesh = tag(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.09, 0.5, 4, 8),
            mat(suitColor)
        ));
        leftLeg.add(lLegMesh);
        group.add(leftLeg);
        this.leftLeg = leftLeg;

        // Right leg
        const rightLeg = new THREE.Group();
        rightLeg.position.set(0.14, 0.55, 0);
        const rLegMesh = tag(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.09, 0.5, 4, 8),
            mat(suitColor)
        ));
        rightLeg.add(rLegMesh);
        group.add(rightLeg);
        this.rightLeg = rightLeg;

        return group;
    }

    init() {
        this.mesh = this.buildRunnerMesh();
        this.mesh.position.copy(this.position);
        // Tag the group itself too
        this.mesh.userData.instance = this;
        this.scene.add(this.mesh);
        this.createHealthBar();
    }

    createHealthBar() {
        const geometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        const fgMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
        this.healthBarBackground = new THREE.Mesh(geometry, bgMat);
        this.healthBarForeground = new THREE.Mesh(geometry, fgMat);
        this.healthBarBackground.position.set(0, 2.1, 0);
        this.healthBarForeground.position.set(0, 2.1, 0.01);
        this.mesh.add(this.healthBarBackground);
        this.mesh.add(this.healthBarForeground);
    }

    update(delta) {
        if (!this.mesh || this.isDead) return;

        // 1. Movement: Wander/chase player
        this.wanderTimer -= delta;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 0.8 + Math.random() * 1.5;
            // Runners bias their direction toward the player
            const toPlayer = this.playerPos.clone().sub(this.position).normalize();
            const random = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize();
            this.wanderDirection.addVectors(toPlayer.multiplyScalar(0.6), random.multiplyScalar(0.4)).normalize();
        }

        this.position.addScaledVector(this.wanderDirection, this.speed * delta);
        this.position.x = THREE.MathUtils.clamp(this.position.x, -this.boundaryLimit, this.boundaryLimit);
        this.position.z = THREE.MathUtils.clamp(this.position.z, -this.boundaryLimit, this.boundaryLimit);
        this.mesh.position.copy(this.position);

        // Smoothly face movement direction
        if (this.wanderDirection.lengthSq() > 0) {
            const targetAngle = Math.atan2(this.wanderDirection.x, this.wanderDirection.z);
            let diff = targetAngle - this.mesh.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.mesh.rotation.y += diff * 10 * delta;
        }

        // 2. Running animation — swing legs/arms
        this.legPhase += delta * this.speed * 3.5;
        this.armPhase += delta * this.speed * 3.5;
        if (this.leftLeg)  this.leftLeg.rotation.x  =  Math.sin(this.legPhase) * 0.55;
        if (this.rightLeg) this.rightLeg.rotation.x  = -Math.sin(this.legPhase) * 0.55;
        if (this.leftArm)  this.leftArm.rotation.x   = -Math.sin(this.armPhase) * 0.4;
        if (this.rightArm) this.rightArm.rotation.x  =  Math.sin(this.armPhase) * 0.4;

        // 3. Health Bar billboarding (face camera)
        if (this.healthBarBackground) {
            const cam = this.scene.getObjectByName('MainCamera');
            const quat = cam?.quaternion || new THREE.Quaternion();
            this.healthBarBackground.quaternion.copy(quat);
            this.healthBarForeground?.quaternion.copy(quat);
        }

        // 4. Shooting logic
        this.shootTimer -= delta;
        if (this.shootTimer <= 0) {
            this.shootAtPlayer();
            this.shootTimer = this.SHOOT_INTERVAL;
        }
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        this.updateHealthBar();
        if (this.health <= 0) {
            this.die();
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
        // Only shoot if within range
        if (distance < 30 && !this.isDead) {
            // Deal damage to player
            this.emitter.emit('player:hit', {
                amount: 1,
                direction: this.position.clone().sub(this.playerPos).normalize()
            });
            // Visual feedback: camera shake
            this.emitter.emit('camera:shake', 0.12);
            // Visual feedback: hit blur vignette
            this.emitter.emit('ui:hitblur');
            // Enemy tracer bullet (red)
            this.emitter.emit('visual:tracer', {
                origin: this.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
                target: this.playerPos.clone().add(new THREE.Vector3(0, 1.5, 0)),
                color: 0xff2200
            });
        }
    }

    die() {
        this.isDead = true;
        this.emitter.emit('target:killed', { position: this.position.clone() });
        this.scene.remove(this.mesh);
    }

    destroy() {
        if (this.mesh) this.scene.remove(this.mesh);
    }
}
