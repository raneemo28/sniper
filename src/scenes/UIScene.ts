import { EventEmitter }  from '../utils/EventEmitter';
import { ScoreSnapshot } from '../systems/ScoreSystem';

export class UIScene {
  private emitter: EventEmitter;

  private elScore!:     HTMLElement;
  private elHighScore!: HTMLElement;
  private elWave!:      HTMLElement;
  private elAmmo!:      HTMLElement;
  private elReload!:    HTMLElement;
  private elTimer!:     HTMLElement;
  private elCrosshair!: HTMLElement;
  private elCountdown!: HTMLElement;
  private elScope!:     HTMLElement;
  private elGameOver!:  HTMLElement;
  private elWaveTransition!: HTMLElement;
  private elHitFlash!:  HTMLElement;
  private elHealthBar!: HTMLElement; // Added for player health

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
    this.buildHUD();
    this.subscribeToEvents();
  }

  private buildHUD(): void {
    const hud = this.createElement('div', 'hud', `
      position: fixed;
      inset: 0;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      color: #eee;
      user-select: none;
    `);

    // Top Left: Score and High Score
    const topLeft = this.createElement('div', '', `
      position: absolute; top: 20px; left: 24px;
      display: flex; flex-direction: column; gap: 4px;
    `);
    this.elScore     = this.createElement('div', '', 'font-size:24px; font-weight:bold; color:#00ffff; text-shadow:0 0 10px #00ffff;');
    this.elHighScore = this.createElement('div', '', 'font-size:12px; opacity:0.6;');
    topLeft.append(this.elScore, this.elHighScore);

    // Top Right: Wave and Timer
    const topRight = this.createElement('div', '', `
      position: absolute; top: 20px; right: 24px;
      display: flex; flex-direction: column; gap: 4px;
      text-align: right;
    `);
    this.elWave = this.createElement('div', '', 'font-size:18px; font-weight:bold; color:#00ffff; transition: opacity 0.3s ease; opacity:0.85;');
    this.elTimer = this.createElement('div', '', 'font-size:14px; opacity:0.85; transition: opacity 0.3s ease; color: #00ffff;');
    this.elWave.innerText = 'WAVE 0';
    this.elTimer.innerText = 'TIME 00:00';
    topRight.append(this.elWave, this.elTimer);

    // Bottom Left: Health Bar
    const healthContainer = this.createElement('div', '', `
      position: absolute; bottom: 40px; left: 24px;
      width: 200px; height: 12px; border: 1px solid rgba(255,255,255,0.3);
      background: rgba(0,0,0,0.5);
    `);
    this.elHealthBar = this.createElement('div', '', `
      width: 100%; height: 100%; background: #ff3333;
      transition: width 0.2s ease-out;
    `);
    healthContainer.appendChild(this.elHealthBar);

    // Bottom Right: Ammo and Reload
    const bottomRight = this.createElement('div', '', `
      position: absolute; bottom: 40px; right: 24px;
      text-align: right;
    `);
    this.elAmmo = this.createElement('div', '', 'font-size:32px; font-weight:bold;');
    this.elReload = this.createElement('div', '', `
      font-size:14px; color:#ffaa00; opacity:0; 
      transition: opacity 0.2s;
    `);
    this.elReload.innerText = 'RELOADING...';
    bottomRight.append(this.elReload, this.elAmmo);

    // Hit Flash Overlay (Vision Blur/Red Shake)
    this.elHitFlash = this.createElement('div', '', `
      position: absolute; inset: 0;
      background: radial-gradient(circle, transparent 40%, rgba(255,0,0,0.3) 100%);
      opacity: 0; pointer-events: none;
      transition: opacity 0.1s;
      backdrop-filter: blur(0px);
    `);

    this.elCrosshair = this.createElement('div', 'crosshair', `
      position: absolute;
      left: 50%; top: 50%;
      width: 24px; height: 24px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      display: none;
      border: 2px solid rgba(0, 255, 255, 0.9);
      border-radius: 50%;
      box-shadow: 0 0 16px rgba(0, 255, 255, 0.25);
    `);

    this.elCountdown = this.createElement('div', 'countdown', `
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      display: none;
      opacity: 0;
      color: #00ffff;
      font-size: 88px;
      font-weight: bold;
      text-shadow: 0 0 30px rgba(255,0,0,0.7);
      letter-spacing: 0.1em;
      transition: opacity 0.4s ease, transform 0.4s ease;
      text-align: center;
      width: 100%;
      max-width: 100vw;
    `);

    // Game Over Overlay
    this.elGameOver = this.createElement('div', 'game-over', `
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.85);
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; pointer-events: all;
    `);

    this.elWaveTransition = this.createElement('div', 'wave-transition', `
      position: absolute; inset: 0;
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; pointer-events: none;
      background: radial-gradient(circle, rgba(0,255,255,0.12) 0%, rgba(0,0,0,0.72) 70%);
      text-shadow: 0 0 18px #00ffff;
    `);

    hud.append(topLeft, topRight, healthContainer, bottomRight, this.elHitFlash, this.elCrosshair, this.elCountdown, this.elWaveTransition, this.elGameOver);
    document.body.appendChild(hud);
  }

  private subscribeToEvents(): void {

    this.emitter.on('ui:health', (data: { current: number, max: number }) => {
    const percent = (data.current / data.max) * 100;
    this.elHealthBar.style.width = `${percent}%`;
    });
    // Update Score
    this.emitter.on('ui:score', (snap: ScoreSnapshot) => {
      this.elScore.innerText = `SCORE: ${snap.score.toLocaleString()}`;
      this.elHighScore.innerText = `BEST: ${snap.highScore.toLocaleString()}`;
    });
    
    // Update Ammo
    this.emitter.on('ui:ammo', ({ current, total }) => {
      this.elAmmo.innerText = `${current} / ${total}`;
    });

    // Handle Reloading Visuals
    this.emitter.on('ui:reload', (isReloading: boolean) => {
      this.elReload.style.opacity = isReloading ? '1' : '0';
    });

    // Player Hit Visuals (Blur & Shake)
    this.emitter.on('ui:playerhit', (healthPercent: number) => {
      this.elHealthBar.style.width = `${healthPercent}%`;
      this.triggerHitEffect();
    });

    this.emitter.on('wave:complete', ({ waveNumber }: { waveNumber: number }) => {
      this.showWaveTransition(waveNumber + 1);
    });

    this.emitter.on('wave:start', () => {
      this.hideWaveTransition();
    });

    this.emitter.on('game:reset', () => {
      this.hideWaveTransition();
      this.elWave.innerText = 'WAVE 0';
      this.elTimer.innerText = 'TIME 00:00';
      this.elTimer.style.color = '#717777';
    });

    this.emitter.on('ui:wave', (wave: number) => {
      this.elWave.innerText = `WAVE ${wave}`;
      this.fadeElement(this.elWave);
    });

    this.emitter.on('ui:timer', (seconds: number) => {
      const time = Math.max(0, Math.ceil(seconds));
      const mins = Math.floor(time / 60).toString().padStart(2, '0');
      const secs = (time % 60).toString().padStart(2, '0');
      this.elTimer.innerText = `TIME ${mins}:${secs}`;
      this.elTimer.style.color = time <= 10 ? '#ff3333' : '#00ffff';
      this.fadeElement(this.elTimer);
    });

    this.emitter.on('ui:countdown', (seconds: number) => {
      this.elCountdown.innerText = `${seconds}`;
      this.elCountdown.style.color = '#00ffff';
      this.elCountdown.style.textShadow = '0 0 30px rgba(0,255,255,0.7)';
      this.showCountdownOverlay(true);
    });

    this.emitter.on('ui:countdown-go', () => {
      this.elCountdown.innerText = 'GO';
      this.elCountdown.style.color = '#ff3333';
      this.elCountdown.style.textShadow = '0 0 30px rgba(255,0,0,0.7)';
      this.elTimer.style.visibility = 'visible';
      this.showCountdownOverlay(false);
    });

    this.emitter.on('ui:countdown-hide', () => {
      this.hideCountdownOverlay();
    });

    this.emitter.on('camera:mode', (mode: 'thirdPerson' | 'playerView' | 'orbit') => {
      this.elCrosshair.style.display = mode === 'playerView' ? 'block' : 'none';
    });
  }
    private triggerHitEffect(): void {
    this.elHitFlash.style.opacity = '1';
    this.elHitFlash.style.backdropFilter = 'blur(4px)';
    
    setTimeout(() => {
      this.elHitFlash.style.opacity = '0';
      this.elHitFlash.style.backdropFilter = 'blur(0px)';
    }, 150);
  }

  showGameOver(snap: ScoreSnapshot): void {
    this.elGameOver.innerHTML = `
      <h1 style="color:#ff3333; font-size:48px; margin-bottom:10px;">MISSION FAILED</h1>
      <p style="font-size:20px; opacity:0.8;">Wave ${snap.wave} Overwhelmed You</p>
      <div style="margin: 20px 0; padding: 20px; border-top: 1px solid #444; border-bottom: 1px solid #444;">
        <div style="font-size:32px; color:#00ffff;">${snap.score.toLocaleString()} PTS</div>
        <div style="font-size:14px; opacity:0.6; margin-top:8px;">
          Kills: ${snap.kills} | Accuracy: ${snap.accuracy}%
        </div>
      </div>
      <button id="restart-btn" style="
        padding: 12px 40px; background: transparent; color: white;
        border: 1px solid #00ffff; cursor: pointer; font-family: inherit;
        font-size: 18px; transition: all 0.2s;
      ">RESTART MISSION</button>
    `;
    
    this.elGameOver.style.display = 'flex';

    document.getElementById('restart-btn')?.addEventListener('click', () => {
      this.elGameOver.style.display = 'none';
      this.emitter.emit('game:reset');
    });
  }

  private showWaveTransition(nextWave: number): void {
    this.elWaveTransition.innerHTML = `
      <div style="font-size:18px; letter-spacing:3px; color:#ffaa00; margin-bottom:12px;">UPGRADING</div>
      <div style="font-size:46px; font-weight:bold; color:#00ffff;">NEXT WAVE ${nextWave}</div>
      <div style="font-size:16px; opacity:0.78; margin-top:12px;">Recalibrating weapon systems...</div>
    `;
    this.elWaveTransition.style.display = 'flex';
  }

  private hideWaveTransition(): void {
    this.elWaveTransition.style.display = 'none';
  }

  private showCountdownOverlay(hideTimer = true): void {
    this.elCountdown.style.display = 'block';
    this.elCountdown.style.opacity = '1';
    this.elCountdown.style.transform = 'translate(-50%, -50%) scale(1.05)';
    if (hideTimer) {
      this.elTimer.style.visibility = 'hidden';
    }

    clearTimeout((this.elCountdown as any)._hideTimeout);
    (this.elCountdown as any)._hideTimeout = setTimeout(() => {
      this.hideCountdownOverlay();
    }, 850);
  }

  private hideCountdownOverlay(): void {
    this.elCountdown.style.opacity = '0';
    this.elCountdown.style.transform = 'translate(-50%, -50%) scale(0.95)';
    setTimeout(() => {
      if (this.elCountdown.style.opacity === '0') {
        this.elCountdown.style.display = 'none';
        this.elTimer.style.visibility = 'visible';
      }
    }, 400);
  }

  private fadeElement(el: HTMLElement): void {
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.opacity = '0.85';
    }, 200);
  }

  private createElement(tag: string, id: string, style: string): HTMLElement {
    const el = document.createElement(tag);
    if (id) el.id = id;
    el.style.cssText = style;
    return el;
  }
}
