
import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter';
import { Target }       from '../components/Target';
import { Player }       from '../components/Player';

export class RaycastSystem {
  private camera:  THREE.PerspectiveCamera;
  private player:  Player;
  private emitter: EventEmitter;
  private raycaster = new THREE.Raycaster();
  private targets: Set<Target> = new Set();

  private shouldFire = false;

  constructor(camera: THREE.PerspectiveCamera, player: Player, emitter: EventEmitter) {
    this.camera  = camera;
    this.player  = player;
    this.emitter = emitter;
    this.subscribeToEvents();
  }

  update(): void {
    if (!this.shouldFire) return;
    this.shouldFire = false;
    this.castRay();
  }

  private castRay(): void {
    const origin = this.player.getShootingOrigin();
    
    // Get camera's forward direction so shooting aligns perfectly with the crosshair/scope
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    // Perform raycast along the direction the camera is facing
    this.raycaster.set(origin, direction);

    const meshes = [...this.targets].map(t => t.mesh);
    const hits   = this.raycaster.intersectObjects(meshes, false);

    if (hits.length === 0) {
      // Trace bullet miss up to 100 meters
      const missEnd = origin.clone().addScaledVector(direction, 100);
      this.emitter.emit('shot:tracer', { origin, target: missEnd });
      
      this.emitter.emit('shot:miss');
      return;
    }

    const hitPoint = hits[0].point;
    // Trace bullet hit
    this.emitter.emit('shot:tracer', { origin, target: hitPoint });

    const hitMesh   = hits[0].object as THREE.Mesh;
    const hitTarget = [...this.targets].find(t => t.mesh === hitMesh);
    if (!hitTarget) return;

    const killed = hitTarget.hit(); 

    if (killed) {
      this.emitter.emit('target:killed', hitTarget);
    } else {
      this.emitter.emit('target:hit', hitTarget);
    }

    this.emitter.emit('shot:hit', hitPoint);
  }

  private subscribeToEvents(): void {
    this.emitter.on('input:fire', () => {
      this.shouldFire = true;
    });

    this.emitter.on('target:spawned', (target: Target) => {
      this.targets.add(target);
    });

    this.emitter.on('target:killed', (target: Target) => {
      this.targets.delete(target);
    });

    this.emitter.on('game:reset', () => {
      this.targets.clear();
    });
  }
}
