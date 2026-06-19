import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter';

type SoundKey =
  | 'shoot'
  | 'reload'
  | 'enemyHit'
  | 'kill'
  | 'playerHit'
  | 'nextWave'
  | 'gameOver'
  | 'footsteps';

interface SoundDef {
  url: string;
  volume: number;
  overlap: boolean;
  loop?: boolean;
}

const SOUND_DEFS: Record<SoundKey, SoundDef> = {
  shoot: {
    url: new URL('../audio/shoot.wav', import.meta.url).href,
    volume: 0.7,
    overlap: true,
  },
  reload: {
    url: new URL('../audio/reload.mp3', import.meta.url).href,
    volume: 0.8,
    overlap: false,
  },
  enemyHit: {
    url: new URL('../audio/enemy_hit.wav', import.meta.url).href,
    volume: 0.6,
    overlap: true,
  },
  kill: {
    url: new URL('../audio/kill.mp3', import.meta.url).href,
    volume: 0.9,
    overlap: true,
  },
  playerHit: {
    url: new URL('../audio/player_hit.wav', import.meta.url).href,
    volume: 1.0,
    overlap: false,
  },
  nextWave: {
    url: new URL('../audio/NextWave.wav', import.meta.url).href,
    volume: 0.9,
    overlap: false,
  },
  gameOver: {
    url: new URL('../audio/GameOver.wav', import.meta.url).href,
    volume: 0.9,
    overlap: false,
  },
  footsteps: {
    url: new URL('../audio/Footsteps.wav', import.meta.url).href,
    volume: 0.6,
    overlap: false,
    loop: true,
  },
};

export class AudioSystem {
  private emitter: EventEmitter;
  private listener: THREE.AudioListener;
  private buffers: Map<SoundKey, AudioBuffer> = new Map();
  private pools: Map<SoundKey, THREE.Audio[]> = new Map();
  private loaded = false;

  private static readonly POOL_SIZE = 4;

  constructor(camera: THREE.PerspectiveCamera, emitter: EventEmitter) {
    this.emitter = emitter;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.subscribeToEvents();
    this.unlockOnFirstGesture();
    this.loadAll();
  }

  private loadAll(): void {
    const loader = new THREE.AudioLoader();
    const keys = Object.keys(SOUND_DEFS) as SoundKey[];
    let remaining = keys.length;

    keys.forEach((key) => {
      const def = SOUND_DEFS[key];

      loader.load(
        def.url,
        (buffer) => {
          this.buffers.set(key, buffer);
          this.pools.set(key, this.buildPool(key, buffer));

          remaining--;
          if (remaining === 0) this.loaded = true;
        },
        undefined,
        (err) => {
          console.warn(`[AudioSystem] Failed to load "${def.url}":`, err);
          remaining--;
          if (remaining === 0) this.loaded = true;
        },
      );
    });
  }

  private buildPool(key: SoundKey, buffer: AudioBuffer): THREE.Audio[] {
    const def = SOUND_DEFS[key];
    const size = def.overlap ? AudioSystem.POOL_SIZE : 1;

    return Array.from({ length: size }, () => {
      const audio = new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      audio.setVolume(def.volume);
      audio.setLoop(def.loop ?? false);
      return audio;
    });
  }

  private subscribeToEvents(): void {
    this.emitter.on('shot:hit', () => this.play('shoot'));
    this.emitter.on('shot:miss', () => this.play('shoot'));

    this.emitter.on('ui:reload', (isReloading: boolean) => {
      if (isReloading) this.play('reload');
    });

    this.emitter.on('target:hit', () => this.play('enemyHit'));
    this.emitter.on('target:killed', () => this.play('kill'));
    this.emitter.on('player:hit', () => this.play('playerHit'));
    this.emitter.on('wave:complete', () => this.play('nextWave'));
    this.emitter.on('ui:gameover', () => {
      this.stopLoop('footsteps');
      this.play('gameOver');
    });
    this.emitter.on('player:moving', (isMoving: boolean) => {
      if (isMoving) this.playLoop('footsteps');
      else this.stopLoop('footsteps');
    });
    this.emitter.on('game:reset', () => this.stopAll());
  }

  private play(key: SoundKey): void {
    if (!this.loaded && !this.buffers.has(key)) return;
    this.resumeContext();

    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) return;

    const voice = pool.find((audio) => !audio.isPlaying) ?? pool[0];

    if (voice.isPlaying) voice.stop();
    voice.play();
  }

  private playLoop(key: SoundKey): void {
    if (!this.loaded && !this.buffers.has(key)) return;
    this.resumeContext();

    const voice = this.pools.get(key)?.[0];
    if (!voice || voice.isPlaying) return;

    voice.play();
  }

  private stopLoop(key: SoundKey): void {
    const voice = this.pools.get(key)?.[0];
    if (voice?.isPlaying) voice.stop();
  }

  private unlockOnFirstGesture(): void {
    const unlock = () => {
      this.resumeContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private resumeContext(): void {
    const context = this.listener.context;
    if (context.state === 'suspended') {
      context.resume().catch((err) => {
        console.warn('[AudioSystem] Failed to resume audio context:', err);
      });
    }
  }

  private stopAll(): void {
    this.pools.forEach((pool) => {
      pool.forEach((audio) => {
        if (audio.isPlaying) audio.stop();
      });
    });
  }

  setMuted(muted: boolean): void {
    this.listener.setMasterVolume(muted ? 0 : 1);
  }

  dispose(): void {
    this.stopAll();
    this.listener.parent?.remove(this.listener);
  }
}
