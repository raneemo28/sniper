import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EventEmitter }  from '../utils/EventEmitter';
import { CAMERA, PLAYER } from '../utils/constants';
import { Player } from '../components/Player';

type CameraMode = 'thirdPerson' | 'playerView' | 'orbit';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private player: Player;

  private yaw   = 0;
  private pitch = 0;

  private isScoped    = false;
  private targetFOV: number   = CAMERA.FOV_DEFAULT;
  private currentFOV: number  = CAMERA.FOV_DEFAULT;

  private mode: CameraMode = 'thirdPerson';
  private orbitControls: OrbitControls | null = null;
  private emitter: EventEmitter;

  constructor(camera: THREE.PerspectiveCamera, player: Player, emitter: EventEmitter) {
    this.camera = camera; 
    this.player = player;
    this.emitter = emitter;
    this.subscribeToEvents(emitter);
  }

  get cameraYaw(): number {
    return this.yaw;
  }

  update(delta: number): void {
    if (this.mode === 'orbit') {
      this.setPlayerVisible(true);
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
    

    if (this.mode === 'playerView' || this.isScoped) {
      this.updatePlayerViewCamera();
    } else {
      this.setPlayerVisible(true);
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
      if (this.mode === 'orbit') return;

      const sens = this.isScoped || this.mode === 'playerView'
        ? PLAYER.MOUSE_SENSITIVITY * 0.3  
        : PLAYER.MOUSE_SENSITIVITY;

      this.yaw   -= dx * sens;
      this.pitch -= dy * sens;
      
      // Clamp vertical pitch to prevent camera from flipping upside down
      const firstPerson = this.isScoped || this.mode === 'playerView';
      const limit = firstPerson ? PLAYER.PITCH_LIMIT : 0.8;
      this.pitch  = THREE.MathUtils.clamp(
        this.pitch,
        firstPerson ? -PLAYER.PITCH_LIMIT : -0.4,
        limit,
      );
    });

    emitter.on('input:zoom', (scopeIn: boolean) => {
      this.isScoped  = scopeIn;
      this.targetFOV = scopeIn ? CAMERA.FOV_SCOPE : CAMERA.FOV_DEFAULT;
      emitter.emit('ui:scope', scopeIn); 
    });

    emitter.on('input:toggleOrbit', () => {
      this.cycleViewMode();
    });
  }

  private updatePlayerViewCamera(): void {
    this.setPlayerVisible(false);
    this.camera.position.copy(this.player.position).add(new THREE.Vector3(0, PLAYER.HEIGHT, 0));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private cycleViewMode(): void {
    if (this.mode === 'thirdPerson') {
      this.mode = 'playerView';
      this.disableOrbit();
      this.emitViewMode();
      return;
    }

    if (this.mode === 'playerView') {
      this.mode = 'orbit';
      this.setPlayerVisible(true);
      this.enableOrbit();
      this.emitViewMode();
      return;
    }

    this.mode = 'thirdPerson';
    this.disableOrbit();
    this.setPlayerVisible(true);
    this.emitViewMode();
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

  private setPlayerVisible(visible: boolean): void {
    if (this.player.mesh) {
      this.player.mesh.visible = visible;
    }
  }

  private emitViewMode(): void {
    this.emitter.emit('camera:mode', this.mode);
  }
}
