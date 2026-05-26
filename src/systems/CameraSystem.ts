import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EventEmitter }  from '../utils/EventEmitter';
import { CAMERA, PLAYER } from '../utils/constants';
import { Player } from '../components/Player';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private player: Player;

  private yaw   = 0;
  private pitch = 0;

  private isScoped    = false;
  private targetFOV   = CAMERA.FOV_DEFAULT;
  private currentFOV  = CAMERA.FOV_DEFAULT;

  private orbitActive   = false;
  private orbitControls: OrbitControls | null = null;

  constructor(camera: THREE.PerspectiveCamera, player: Player, emitter: EventEmitter) {
    this.camera = camera;
    this.player = player;
    this.subscribeToEvents(emitter);
  }

  get cameraYaw(): number {
    return this.yaw;
  }

  update(delta: number): void {
    if (this.orbitActive) {
      this.orbitControls?.update();
      return; 
    }

    if (Math.abs(this.currentFOV - this.targetFOV) > 0.1) {
        this.currentFOV = THREE.MathUtils.lerp(
        this.currentFOV,
        this.targetFOV,
        1 - Math.pow(0.01, delta), 
      );
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
    }

    if (this.isScoped) {
      // First-person view from the player's head when scoped in for sniper aiming
      this.camera.position.copy(this.player.position).add(new THREE.Vector3(0, 1.7, 0));
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      // Third-person smooth follow camera centered around player
      const targetOffset = new THREE.Vector3(0, 2.0, 5.0); // 5m back, 2m high
      // Apply vertical tilt (pitch) and horizontal rotation (yaw) to the offset
      targetOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
      targetOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      
      const targetPos = this.player.position.clone().add(targetOffset);
      // FIX: Delta-time compensated lerping
      const lerpFactor = 1 - Math.pow(0.001, delta); 
      this.camera.position.lerp(targetPos, lerpFactor);
      
      // Lerp camera position for a highly premium, cinematic damping feel
      this.camera.position.lerp(targetPos, 0.18);
      
      // Look at the player's mid-to-upper body
      const lookAtTarget = this.player.position.clone().add(new THREE.Vector3(0, 1.3, 0));
      this.camera.lookAt(lookAtTarget);
    }
  }

  private subscribeToEvents(emitter: EventEmitter): void {
    emitter.on('input:mousemove', (dx: number, dy: number) => {
      if (this.orbitActive) return;

      const sens = this.isScoped
        ? PLAYER.MOUSE_SENSITIVITY * 0.3  
        : PLAYER.MOUSE_SENSITIVITY;

      this.yaw   -= dx * sens;
      this.pitch -= dy * sens;
      
      // Clamp vertical pitch to prevent camera from flipping upside down
      const limit = this.isScoped ? PLAYER.PITCH_LIMIT : 0.8;
      this.pitch  = THREE.MathUtils.clamp(
        this.pitch,
        this.isScoped ? -PLAYER.PITCH_LIMIT : -0.4,
        limit,
      );
    });

    emitter.on('input:zoom', (scopeIn: boolean) => {
      this.isScoped  = scopeIn;
      this.targetFOV = scopeIn ? CAMERA.FOV_SCOPE : CAMERA.FOV_DEFAULT;
      emitter.emit('ui:scope', scopeIn); 
    });

    emitter.on('input:toggleOrbit', () => {
      this.orbitActive = !this.orbitActive;

      if (this.orbitActive) {
        this.enableOrbit();
      } else {
        this.disableOrbit();
      }
    });
  }

  private enableOrbit(): void {
    if (!this.orbitControls) {
      this.orbitControls = new OrbitControls(
        this.camera,
        document.body,
      );
      this.orbitControls.enableDamping = true;
      this.orbitControls.dampingFactor = 0.08;
      this.orbitControls.minDistance   = 5;
      this.orbitControls.maxDistance   = 60;
    }

    this.camera.position.set(0, 20, 20);
    this.camera.lookAt(0, 0, 0);
    this.orbitControls.enabled = true;
  }

  private disableOrbit(): void {
    if (this.orbitControls) {
      this.orbitControls.enabled = false;
    }
  }
}
