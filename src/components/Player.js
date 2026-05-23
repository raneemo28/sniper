import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
export class Player {
    mesh = null;
    position = new THREE.Vector3(0, 0, 0);
    scene;
    mixer = null;
    walkAction = null;
    keys = {};
    speed = 5.5;
    scale = 1.8; // CesiumMan is about 1m tall; scaling to 1.8 makes him human-sized
    boundaryLimit = 19; // Rooftop half-size is 20, clamp to 19 to keep player safe
    constructor(scene, emitter) {
        this.scene = scene;
        this.loadModel();
        // Subscribe to keyboard inputs from the InputHandler
        emitter.on('input:keys', (keys) => {
            this.keys = keys;
        });
    }
    loadModel() {
        const loader = new GLTFLoader();
        loader.load('/src/models/CesiumMan.glb', (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.scale.set(this.scale, this.scale, this.scale);
            this.mesh.position.copy(this.position);
            // Enable shadows for the character
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            // Rotate the model by 180 degrees initially so he faces forward
            this.mesh.rotation.y = Math.PI;
            this.scene.add(this.mesh);
            // Setup walking animations using the mixer
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.mesh);
                this.walkAction = this.mixer.clipAction(gltf.animations[0]);
                this.walkAction.play();
                this.walkAction.paused = true; // Start in standing/idle state
            }
        }, undefined, (error) => {
            console.error('[Player] Failed to load model:', error);
        });
    }
    update(delta, cameraYaw) {
        if (!this.mesh)
            return;
        // Calculate movement directions relative to current camera yaw rotation
        const moveDirection = new THREE.Vector3();
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw).normalize();
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw).normalize();
        if (this.keys['KeyW'] || this.keys['ArrowUp'])
            moveDirection.add(forward);
        if (this.keys['KeyS'] || this.keys['ArrowDown'])
            moveDirection.add(forward.clone().negate());
        if (this.keys['KeyD'] || this.keys['ArrowRight'])
            moveDirection.add(right);
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])
            moveDirection.add(right.clone().negate());
        const isMoving = moveDirection.lengthSq() > 0;
        if (isMoving) {
            moveDirection.normalize();
            // Update position vector
            this.position.addScaledVector(moveDirection, this.speed * delta);
            // Clamp within rooftop boundaries
            this.position.x = THREE.MathUtils.clamp(this.position.x, -this.boundaryLimit, this.boundaryLimit);
            this.position.z = THREE.MathUtils.clamp(this.position.z, -this.boundaryLimit, this.boundaryLimit);
            this.mesh.position.copy(this.position);
            // Rotate player to face the movement direction (accounting for 180 deg offset of CesiumMan model)
            const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
            let diff = targetAngle - this.mesh.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.mesh.rotation.y += diff * 0.2; // Smooth rotation lerp
            // Play walk animation
            if (this.walkAction) {
                this.walkAction.paused = false;
                this.walkAction.timeScale = 1.35; // Fine-tuned animation speed multiplier
            }
        }
        else {
            // Stand still
            if (this.walkAction) {
                this.walkAction.paused = true;
            }
        }
        // Advance animation mixer
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }
    reset() {
        this.position.set(0, 0, 0);
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
    getFacingDirection() {
        if (!this.mesh)
            return new THREE.Vector3(0, 0, -1);
        // The visual front of CesiumMan corresponds to local +Z rotated by the mesh quaternion
        const localFront = new THREE.Vector3(0, 0, 1);
        return localFront.applyQuaternion(this.mesh.quaternion).normalize();
    }
    getShootingOrigin() {
        // Shoulder/chest height of the scaled character
        return this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    }
    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
    }
}
