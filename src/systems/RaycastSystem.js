import * as THREE from 'three';
const MAG_SIZE = 5;
const RELOAD_TIME_MS = 1800;
export class RaycastSystem {
    camera;
    player;
    emitter;
    raycaster = new THREE.Raycaster();
    shouldFire = false;
    ammo = MAG_SIZE;
    reloading = false;
    cameraMode = 'thirdPerson';
    reloadTimeoutId = null;
    constructor(camera, player, emitter) {
        this.camera = camera;
        this.player = player;
        this.emitter = emitter;
        this.subscribeToEvents();
        this.pushAmmoUI();
    }
    subscribeToEvents() {
        // Listen for the fire command from InputHandler
        this.emitter.on('input:fire', () => {
            this.shouldFire = true;
        });
        // Listen for manual reload command (R Key)
        this.emitter.on('input:reload', () => {
            this.startReload();
        });
        this.emitter.on('camera:mode', (mode) => {
            this.cameraMode = mode;
        });
    }
    update() {
        if (!this.shouldFire)
            return;
        this.shouldFire = false;
        if (this.reloading)
            return;
        if (this.ammo <= 0) {
            this.startReload();
            return;
        }
        this.ammo--;
        this.pushAmmoUI();
        this.castRay();
    }
    startReload() {
        if (this.reloading || this.ammo === MAG_SIZE)
            return;
        this.reloading = true;
        this.emitter.emit('ui:reload', true);
        this.reloadTimeoutId = setTimeout(() => {
            this.ammo = MAG_SIZE;
            this.reloading = false;
            this.emitter.emit('ui:reload', false);
            this.pushAmmoUI();
        }, RELOAD_TIME_MS);
    }
    castRay() {
        const origin = this.player.getShootingOrigin();
        if (this.cameraMode === 'playerView') {
            // Player-eye view shoots exactly through the center of the camera.
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        }
        else {
            // Third-person and orbit views shoot from the character toward the face direction.
            this.raycaster.set(origin, this.player.getFacingDirection());
        }
        // We only want to check against Enemy meshes
        // In a real scenario, you'd pass a list of enemy meshes here
        this.emitter.emit('raycast:request_targets', (targets) => {
            const intersects = this.raycaster.intersectObjects(targets, true);
            let hitPoint;
            if (intersects.length > 0) {
                const hit = intersects[0];
                hitPoint = hit.point;
                const enemyInstance = this.findEnemyInstance(hit.object);
                if (enemyInstance) {
                    enemyInstance.takeDamage(1); // Multi-hit logic
                    this.emitter.emit('shot:hit');
                }
                else {
                    this.emitter.emit('shot:miss');
                }
            }
            else {
                // If nothing hit, the tracer goes 100 units into the distance
                hitPoint = this.raycaster.ray.at(100, new THREE.Vector3());
                this.emitter.emit('shot:miss');
            }
            // 2. Create the Neon Cyan Tracer effect
            // This calls createTracer in GameScene.ts
            this.emitter.emit('visual:tracer', {
                origin: origin,
                target: hitPoint,
                color: 0x00ffff // Neon Cyan
            });
        });
    }
    findEnemyInstance(object) {
        let current = object;
        while (current) {
            const enemy = current.userData.instance;
            if (enemy)
                return enemy;
            current = current.parent;
        }
        return null;
    }
    pushAmmoUI() {
        this.emitter.emit('ui:ammo', {
            current: this.ammo,
            total: MAG_SIZE
        });
    }
    reset() {
        this.ammo = MAG_SIZE;
        this.reloading = false;
        if (this.reloadTimeoutId)
            clearTimeout(this.reloadTimeoutId);
        this.pushAmmoUI();
    }
}
