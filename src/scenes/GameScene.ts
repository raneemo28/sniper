import * as THREE from 'three';
import { CAMERA, ENVIRONMENT, PLAYER } from '../utils/constants';

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.FOV_DEFAULT,
      window.innerWidth / window.innerHeight,
      CAMERA.NEAR,
      CAMERA.FAR,
    );

    this.buildScene();
  }

  private buildScene(): void {
    this.setupFog();
    this.setupLighting();
    this.buildRooftop();
    this.buildBuildings();
    this.buildStreetLights();
    this.positionCamera();
  }

  private setupFog(): void {
    this.scene.fog = new THREE.Fog(
      0x0a0a14,
      ENVIRONMENT.FOG_NEAR,
      ENVIRONMENT.FOG_FAR,
    );
    this.scene.background = new THREE.Color(0x0a0a14);
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x111133, 0.6);
    this.scene.add(ambient);

    const moon = new THREE.DirectionalLight(0x9999cc, 0.8);
    moon.position.set(20, 40, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 120;
    moon.shadow.camera.left = moon.shadow.camera.bottom = -30;
    moon.shadow.camera.right = moon.shadow.camera.top = 30;
    this.scene.add(moon);
  }

  private buildRooftop(): void {
    const s = ENVIRONMENT.ROOFTOP_SIZE * 2;

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(s, 0.3, s),
      new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.9 }),
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2a, roughness: 0.8 });
    const wallH = 0.6;
    const wallT = 0.2;
    const wallConfigs: [number, number, number, number, number, number][] = [
      [s, wallH, wallT, 0, wallH / 2, s / 2],
      [s, wallH, wallT, 0, wallH / 2, -s / 2],
      [wallT, wallH, s, s / 2, wallH / 2, 0],
      [wallT, wallH, s, -s / 2, wallH / 2, 0],
    ];
    wallConfigs.forEach(([w, h, d, x, y, z]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      wall.position.set(x, y, z);
      wall.receiveShadow = true;
      this.scene.add(wall);
    });
  }

  private buildBuildings(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x14141e, roughness: 1 });
    const rng = ENVIRONMENT.ROOFTOP_SIZE;

    for (let i = 0; i < ENVIRONMENT.BUILDING_COUNT; i++) {
      const w = 4 + Math.random() * 6;
      const h = 8 + Math.random() * 20;
      const d = 4 + Math.random() * 6;

      const side = i % 4;
      const offset = rng + 6 + Math.random() * 12;
      const lateral = (Math.random() - 0.5) * rng * 2;

      let x = 0, z = 0;
      if (side === 0) { x = offset; z = lateral; }
      else if (side === 1) { x = -offset; z = lateral; }
      else if (side === 2) { x = lateral; z = offset; }
      else if (side === 3) { x = lateral; z = -offset; }

      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      building.position.set(x, h / 2 - 0.15, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.scene.add(building);

      this.addWindows(building, w, h, d, side);
    }
  }

  private addWindows(building: THREE.Mesh, w: number, h: number, d: number, side: number): void {
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xffdd88,
      emissive: 0xffdd88,
      emissiveIntensity: 0.8,
    });
    const cols = Math.floor(w / 1.4);
    const rows = Math.floor(h / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.4) continue;

        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), windowMat);
        const wx = -w / 2 + 0.7 + c * 1.4;
        const wy = -h / 2 + 1.2 + r * 2;

        if (side === 0) { win.position.set(-w / 2 - 0.01, wy, wx); win.rotation.y = Math.PI / 2; }
        else if (side === 1) { win.position.set(w / 2 + 0.01, wy, wx); win.rotation.y = -Math.PI / 2; }
        else if (side === 2) { win.position.set(wx, wy, -d / 2 - 0.01); }
        else if (side === 3) { win.position.set(wx, wy, d / 2 + 0.01); win.rotation.y = Math.PI; }

        building.add(win);
      }
    }
  }

  private buildStreetLights(): void {
    const count = ENVIRONMENT.STREET_LIGHT_COUNT;
    const rng = ENVIRONMENT.ROOFTOP_SIZE;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x444455 });

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = rng - 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.5, 8), poleMat);
      pole.position.set(x, 1.75, z);
      this.scene.add(pole);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffeeaa,
          emissive: 0xffeeaa,
          emissiveIntensity: 1,
        }),
      );
      head.position.set(x, 3.6, z);
      this.scene.add(head);

      const light = new THREE.PointLight(0xffcc66, 1.2, 12);
      light.position.set(x, 3.5, z);
      light.castShadow = true;
      light.shadow.mapSize.set(256, 256);
      this.scene.add(light);
    }
  }

  private positionCamera(): void {
    this.camera.position.set(0, PLAYER.HEIGHT, 0);
    this.camera.rotation.order = 'YXZ';
  }

  createTracer(origin: THREE.Vector3, target: THREE.Vector3, color = 0x00ffcc): void {
    const points = [origin, target];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);

    let duration = 0.12;
    let lastTime = performance.now();

    const tickFade = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      duration -= dt;

      if (duration <= 0) {
        this.scene.remove(line);
        geom.dispose();
        mat.dispose();
      } else {
        mat.opacity = duration / 0.12;
        requestAnimationFrame(tickFade);
      }
    };
    requestAnimationFrame(tickFade);
  }
}