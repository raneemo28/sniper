
import { EventEmitter }  from '../utils/EventEmitter';
import { ScoreSnapshot } from '../systems/ScoreSystem';

export class UIScene {
  private emitter: EventEmitter;

  private elScore!:     HTMLElement;
  private elHighScore!: HTMLElement;
  private elWave!:      HTMLElement;
  private elAmmo!:      HTMLElement;
  private elTimer!:     HTMLElement;
  private elCrosshair!: HTMLElement;
  private elScope!:     HTMLElement;
  private elCountdown!: HTMLElement;
  private elMessage!:   HTMLElement;
  private elGameOver!:  HTMLElement;

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
    const topLeft = this.createElement('div', '', `
      position: absolute; top: 20px; left: 24px;
      display: flex; flex-direction: column; gap: 4px;
    `);
    this.elScore     = this.createElement('div', '', 'font-size:22px; font-weight:bold; letter-spacing:1px;');
    this.elHighScore = this.createElement('div', '', 'font-size:12px; opacity:0.6;');
    topLeft.append(this.elScore, this.elHighScore);

    const topRight = this.createElement('div', '', `
      position: absolute; top: 20px; right: 24px; text-align: right;
      display: flex; flex-direction: column; gap: 4px;
    `);
    this.elWave  = this.createElement('div', '', 'font-size:16px; opacity:0.85;');
    this.elTimer = this.createElement('div', '', 'font-size:14px; opacity:0.6;');
    topRight.append(this.elWave, this.elTimer);

    this.elAmmo = this.createElement('div', '', `
      position: absolute; bottom: 30px; right: 24px;
      font-size:18px; letter-spacing:2px; opacity:0.85;
    `);

    this.elCrosshair = this.createElement('div', 'crosshair', `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 16px; height: 16px;
    `);
    this.elCrosshair.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="0"  x2="8"  y2="6"  stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
        <line x1="8" y1="10" x2="8"  y2="16" stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
        <line x1="0" y1="8"  x2="6"  y2="8"  stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
        <line x1="10" y1="8" x2="16" y2="8"  stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
        <circle cx="8" cy="8" r="1" fill="rgba(255,255,255,0.8)"/>
      </svg>
    `;

    this.elScope = this.createElement('div', 'scope', `
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.97) 19%);
      display: none;
    `);

    this.elCountdown = this.createElement('div', '', `
      position: absolute;
      top: 40%; left: 50%; transform: translate(-50%, -50%);
      font-size: 72px; font-weight: bold; opacity: 0; text-align: center;
      text-shadow: 0 2px 12px rgba(0,0,0,0.8);
      transition: opacity 0.2s;
    `);

    this.elMessage = this.createElement('div', '', `
      position: absolute;
      top: 35%; left: 50%; transform: translate(-50%, -50%);
      font-size: 28px; font-weight: bold; text-align: center;
      opacity: 0; transition: opacity 0.3s;
      text-shadow: 0 2px 8px rgba(0,0,0,0.9);
    `);

    this.elGameOver = this.createElement('div', 'gameover', `
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.82);
      display: none;
      flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
      pointer-events: all;
    `);

    hud.append(
      topLeft, topRight,
      this.elAmmo,
      this.elCrosshair,
      this.elScope,
      this.elCountdown,
      this.elMessage,
      this.elGameOver,
    );
    document.body.appendChild(hud);

    this.setScore({ score: 0, kills: 0, shots: 0, hits: 0, accuracy: 0, wave: 0, highScore: 0 });
    this.setAmmo(10, 10);
  }

  private subscribeToEvents(): void {
    this.emitter.on('ui:scoreupdate', (snap: ScoreSnapshot) => {
      this.setScore(snap);
    });

    this.emitter.on('ui:ammo', ({ current, max }: { current: number; max: number }) => {
      this.setAmmo(current, max);
    });

    this.emitter.on('ui:scope', (active: boolean) => {
      this.elScope.style.display      = active ? 'block' : 'none';
      this.elCrosshair.style.display  = active ? 'none'  : 'block';
    });

    this.emitter.on('wave:countdown:tick', (seconds: number) => {
      this.elCountdown.textContent  = seconds > 0 ? String(seconds) : 'GO!';
      this.elCountdown.style.opacity = '1';
      if (seconds <= 0) {
        setTimeout(() => { this.elCountdown.style.opacity = '0'; }, 600);
      }
    });

    this.emitter.on('wave:start', ({ waveNumber }: { waveNumber: number }) => {
      this.elWave.textContent = `Wave ${waveNumber}`;
    });

    this.emitter.on('wave:complete', () => {
      this.flash('Wave complete!', '#88ffaa');
    });

    this.emitter.on('wave:failed', () => {
      this.flash('Time\'s up!', '#ff6666');
    });

    this.emitter.on('ui:wavebonus', (bonus: number) => {
      this.flash(`+${bonus} wave bonus`, '#ffdd66');
    });

    this.emitter.on('ui:timer', (seconds: number) => {
      this.elTimer.textContent = `${Math.ceil(seconds)}s`;
      this.elTimer.style.color = seconds < 10 ? '#ff6666' : '#eee';
    });

    this.emitter.on('ui:gameover', (snap: ScoreSnapshot) => {
      this.showGameOver(snap);
    });

    this.emitter.on('game:reset', () => {
      this.elGameOver.style.display = 'none';
    });
  }

  private setScore(snap: ScoreSnapshot): void {
    this.elScore.textContent     = `Score  ${snap.score.toLocaleString()}`;
    this.elHighScore.textContent = `Best   ${snap.highScore.toLocaleString()}`;
  }

  private setAmmo(current: number, max: number): void {
    this.elAmmo.textContent = `${current} / ${max}`;
  }

  private flash(message: string, color = '#ffffff'): void {
    this.elMessage.textContent    = message;
    this.elMessage.style.color    = color;
    this.elMessage.style.opacity  = '1';
    setTimeout(() => { this.elMessage.style.opacity = '0'; }, 1800);
  }

  private showGameOver(snap: ScoreSnapshot): void {
    this.elGameOver.innerHTML = `
      <div style="font-size:42px;font-weight:bold;letter-spacing:2px">Game Over</div>
      <div style="font-size:20px;opacity:0.8">Wave ${snap.wave} reached</div>
      <div style="font-size:28px;font-weight:bold;margin-top:8px">
        ${snap.score.toLocaleString()} pts
      </div>
      <div style="font-size:14px;opacity:0.6">
        ${snap.kills} kills &nbsp;·&nbsp; ${snap.accuracy}% accuracy
      </div>
      <div style="font-size:14px;opacity:0.5;margin-top:4px">
        Best: ${snap.highScore.toLocaleString()}
      </div>
      <button id="restart-btn" style="
        margin-top:24px; padding:12px 32px;
        font-family: inherit; font-size:16px; letter-spacing:1px;
        background: transparent; color: #eee;
        border: 1px solid rgba(255,255,255,0.4);
        cursor: pointer; pointer-events: all;
      ">Play again</button>
    `;
    this.elGameOver.style.display = 'flex';

    document.getElementById('restart-btn')?.addEventListener('click', () => {
      this.emitter.emit('game:reset');
    }, { once: true });
  }

  private createElement(
    tag: string,
    id: string,
    style: string,
  ): HTMLElement {
    const el = document.createElement(tag);
    if (id) el.id = id;
    el.style.cssText = style;
    return el;
  }
}
