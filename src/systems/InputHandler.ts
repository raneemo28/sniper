import { EventEmitter } from '../utils/EventEmitter';

export class InputHandler {
  private emitter: EventEmitter;
  private pendingFire  = false;
  private pendingZoom  = false; 
  private zoomActive   = false;
  private mouseDeltaX  = 0;
  private mouseDeltaY  = 0;

  private keys: Record<string, boolean> = {};
  private isMenuActive = true;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
    this.bindEvents();
    
    this.emitter.on('game:start', () => {
      this.isMenuActive = false;
      document.body.requestPointerLock();
    });

    this.emitter.on('ui:gameover', () => {
      this.isMenuActive = true;
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
    });
  }

  update(): void {
    // 1. Handle Mouse Movement for Aiming
    if (this.mouseDeltaX !== 0 || this.mouseDeltaY !== 0) {
      this.emitter.emit('input:mousemove', this.mouseDeltaX, this.mouseDeltaY);
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }

    // 2. Handle Shooting (Left-Click)
    if (this.pendingFire) {
      this.emitter.emit('input:fire');
      this.pendingFire = false;
    }

    // 3. Handle Zooming (Right-Click)
    if (this.pendingZoom) {
      this.emitter.emit('input:zoom', this.zoomActive);
      this.pendingZoom = false;
    }

    // 4. Send all current key states (WASD + Arrows) to the Player class
    this.emitter.emit('input:keys', { ...this.keys });
  }

  private bindEvents(): void {
    // Pointer Lock for FPS-style mouse control
    document.addEventListener('click', () => {
      if (!this.isMenuActive && document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== document.body) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    document.addEventListener('mousedown', (e) => {
      // Left-Click to shoot
      if (e.button === 0) this.pendingFire = true;   
      // Right-Click (Hold) to zoom
      if (e.button === 2) {                           
        this.zoomActive  = true;
        this.pendingZoom = true;
      }
    });

    document.addEventListener('mouseup', (e) => {
      // Release Right-Click to un-zoom
      if (e.button === 2) {                          
        this.zoomActive  = false;
        this.pendingZoom = true;
      }
    });

    // Prevent context menu on right-click to allow zooming
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Special View: Toggle Orbit Camera (Free Cam)
      if (e.code === 'Tab') {
        e.preventDefault();
        this.emitter.emit('input:toggleOrbit');
      }

      // Manual Reload
      if (e.code === 'KeyR') {
        this.emitter.emit('input:reload');
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }
}