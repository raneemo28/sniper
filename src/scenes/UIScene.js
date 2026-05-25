export class UIScene {
    emitter;
    elScore;
    elHighScore;
    elWave;
    elAmmo;
    elReload;
    elTimer;
    elCrosshair;
    elScope;
    elGameOver;
    elHitFlash;
    elHealthBar;
    constructor(emitter) {
        this.emitter = emitter;
        this.buildHUD();
        this.subscribeToEvents();
    }
    buildHUD() {
        const hud = this.createElement('div', 'hud', `
      position: fixed;
      inset: 0;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      color: #eee;
      user-select: none;
    `);
        // Top Left: Score, High Score, Wave
        const topLeft = this.createElement('div', '', `
      position: absolute; top: 20px; left: 24px;
      display: flex; flex-direction: column; gap: 4px;
    `);
        this.elScore = this.createElement('div', '', 'font-size:24px; font-weight:bold; color:#00ffff; text-shadow:0 0 10px #00ffff;');
        this.elHighScore = this.createElement('div', '', 'font-size:12px; opacity:0.6;');
        this.elWave = this.createElement('div', '', 'font-size:14px; color:#ffaa44; margin-top:4px;');
        this.elWave.innerText = 'WAVE 1';
        topLeft.append(this.elScore, this.elHighScore, this.elWave);
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
        // Game Over Overlay
        this.elGameOver = this.createElement('div', 'game-over', `
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.85);
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; pointer-events: all;
    `);
        hud.append(topLeft, healthContainer, bottomRight, this.elHitFlash, this.elGameOver);
        document.body.appendChild(hud);
    }
    subscribeToEvents() {
        this.emitter.on('ui:health', (data) => {
            const percent = (data.current / data.max) * 100;
            this.elHealthBar.style.width = `${percent}%`;
        });
        // Update Score
        this.emitter.on('ui:score', (snap) => {
            this.elScore.innerText = `SCORE: ${snap.score.toLocaleString()}`;
            this.elHighScore.innerText = `BEST: ${snap.highScore.toLocaleString()}`;
        });
        // Update Wave display
        this.emitter.on('wave:start', ({ waveNumber }) => {
            if (this.elWave) this.elWave.innerText = `WAVE ${waveNumber}`;
        });
        // Update Ammo
        this.emitter.on('ui:ammo', ({ current, total }) => {
            this.elAmmo.innerText = `${current} / ${total}`;
        });
        // Handle Reloading Visuals
        this.emitter.on('ui:reload', (isReloading) => {
            this.elReload.style.opacity = isReloading ? '1' : '0';
        });
        // Player Hit Visuals (Blur & Shake)
        this.emitter.on('ui:playerhit', (healthPercent) => {
            this.elHealthBar.style.width = `${healthPercent}%`;
            this.triggerHitEffect();
        });
        // FIX BUG 6: Also listen to 'ui:hitblur' — emitted directly by Enemy.shootAtPlayer()
        this.emitter.on('ui:hitblur', () => {
            this.triggerHitEffect();
        });
        // Game Over Logic — ui:gameover is now called directly from Game.onGameOver()
        // via uiScene.showGameOver(snap), so no need to listen here.
    }
    triggerHitEffect() {
        this.elHitFlash.style.opacity = '1';
        this.elHitFlash.style.backdropFilter = 'blur(4px)';
        setTimeout(() => {
            this.elHitFlash.style.opacity = '0';
            this.elHitFlash.style.backdropFilter = 'blur(0px)';
        }, 150);
    }
    showGameOver(snap) {
        // FIX BUG 2: Handle missing/partial snap with safe defaults
        const safeSnap = {
            wave: snap?.wave ?? 1,
            score: snap?.score ?? 0,
            kills: snap?.kills ?? 0,
            accuracy: snap?.accuracy ?? 0,
            highScore: snap?.highScore ?? 0,
        };
        this.elGameOver.innerHTML = `
      <h1 style="color:#ff3333; font-size:48px; margin-bottom:10px; text-shadow: 0 0 30px #ff0000;">MISSION FAILED</h1>
      <p style="font-size:20px; opacity:0.8;">Wave ${safeSnap.wave} Overwhelmed You</p>
      <div style="margin: 20px 0; padding: 20px; border-top: 1px solid #444; border-bottom: 1px solid #444;">
        <div style="font-size:32px; color:#00ffff; text-shadow: 0 0 15px #00ffff;">${safeSnap.score.toLocaleString()} PTS</div>
        <div style="font-size:14px; opacity:0.6; margin-top:8px;">
          Kills: ${safeSnap.kills} | Accuracy: ${safeSnap.accuracy}%
        </div>
        <div style="font-size:12px; opacity:0.4; margin-top:4px;">Best: ${safeSnap.highScore.toLocaleString()}</div>
      </div>
      <button id="restart-btn" style="
        padding: 12px 40px; background: transparent; color: white;
        border: 1px solid #00ffff; cursor: pointer; font-family: inherit;
        font-size: 18px; transition: all 0.2s; letter-spacing: 2px;
      ">RESTART MISSION</button>
    `;
        this.elGameOver.style.display = 'flex';
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            this.elGameOver.style.display = 'none';
            this.emitter.emit('game:reset');
        });
    }
    createElement(tag, id, style) {
        const el = document.createElement(tag);
        if (id)
            el.id = id;
        el.style.cssText = style;
        return el;
    }
}
