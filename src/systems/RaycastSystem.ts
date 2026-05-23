import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter';
import { Player }       from '../components/Player';
import { Enemy }        from '../components/Enemy';

const MAG_SIZE       = 5;
const RELOAD_TIME_MS = 1800; 

export class RaycastSystem {
  private camera:  THREE.PerspectiveCamera;
  private player:  Player;
  private emitter: EventEmitter;
  private raycaster = new THREE.Raycaster();
  
  private shouldFire = false;
  private ammo      = MAG_SIZE;
  private reloading = false;
  private reloadTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(camera: THREE.PerspectiveCamera, player: Player, emitter: EventEmitter) {
    this.camera  = camera;
    this.player  = player;
    this.emitter = emitter;

    this.subscribeToEvents();
    this.pushAmmoUI();
  }

  private subscribeToEvents(): void {
    // Listen for the fire command from InputHandler
    this.emitter.on('input:fire', () => {
      this.shouldFire = true;
    });

    // Listen for manual reload command (R Key)
    this.emitter.on('input:reload', () => {
      this.startReload();
    });
  }

  update(): void {
    if (!this.shouldFire) return;
    this.shouldFire = false;

    if (this.reloading) return; 

    if (this.ammo <= 0) {
      this.startReload();
      return;
    }

    this.ammo--;
    this.pushAmmoUI();
    this.castRay();
  }

  private startReload(): void {
    if (this.reloading || this.ammo === MAG_SIZE) return;
    
    this.reloading = true;
    this.emitter.emit('ui:reload', true);
    
    this.reloadTimeoutId = setTimeout(() => {
      this.ammo      = MAG_SIZE;
      this.reloading = false;
      this.emitter.emit('ui:reload', false);
      this.pushAmmoUI();
    }, RELOAD_TIME_MS);
  }

  private castRay(): void {
    const origin = this.player.getShootingOrigin();

    // 1. Raycast from camera center to find what the player is looking at
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    
    // We only want to check against Enemy meshes
    // In a real scenario, you'd pass a list of enemy meshes here
    this.emitter.emit('raycast:request_targets', (targets: THREE.Object3D[]) => {
      const intersects = this.raycaster.intersectObjects(targets, true);
      
      let hitPoint: THREE.Vector3;

      if (intersects.length > 0) {
        const hit = intersects[0];
        hitPoint = hit.point;

        // Find the Enemy instance associated with this mesh
        // This assumes enemies store their instance reference in userData
        const enemyInstance = hit.object.userData.instance as Enemy;
        
        if (enemyInstance) {
          enemyInstance.takeDamage(1); // Multi-hit logic
          this.emitter.emit('shot:hit');
        }
      } else {
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

  private pushAmmoUI(): void {
    this.emitter.emit('ui:ammo', {
      current: this.ammo,
      total: MAG_SIZE
    });
  }

  reset(): void {
    this.ammo = MAG_SIZE;
    this.reloading = false;
    if (this.reloadTimeoutId) clearTimeout(this.reloadTimeoutId);
    this.pushAmmoUI();
  }
}