import { SCORE } from '../utils/constants';
const HIGH_SCORE_KEY = 'rooftopSniper_highScore';
export class ScoreSystem {
    emitter;
    _score = 0;
    _kills = 0;
    _shots = 0;
    _hits = 0;
    _wave = 0;
    _highScore;
    constructor(emitter) {
        this.emitter = emitter;
        this._highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) ?? '0', 10);
        this.subscribeToEvents();
    }
    get score() { return this._score; }
    get highScore() { return this._highScore; }
    snapshot() {
        return {
            score: this._score,
            kills: this._kills,
            shots: this._shots,
            hits: this._hits,
            accuracy: this._shots > 0 ? Math.round((this._hits / this._shots) * 100) : 0,
            wave: this._wave,
            highScore: this._highScore,
        };
    }
    subscribeToEvents() {
        this.emitter.on('target:hit', () => {
            this._hits++;
            this.add(SCORE.HIT_POINTS);
        });
        this.emitter.on('target:killed', () => {
            this._hits++; // FIX: Account for the lethal hit
            this._kills++;
            this.add(SCORE.KILL_POINTS);
        });
        this.emitter.on('shot:miss', () => {
            this._shots++;
            if (SCORE.MISS_PENALTY > 0)
                this.add(-SCORE.MISS_PENALTY);
            this.pushUI();
        });
        this.emitter.on('shot:hit', () => {
            this._shots++;
        });
        this.emitter.on('wave:complete', ({ waveNumber }) => {
            this._wave = waveNumber;
            const bonus = SCORE.WAVE_BONUS * waveNumber;
            this.add(bonus);
            this.emitter.emit('ui:wavebonus', bonus);
        });
        this.emitter.on('wave:start', ({ waveNumber }) => {
            this._wave = waveNumber;
            this.pushUI();
        });
        this.emitter.on('game:reset', () => {
            this._score = 0;
            this._kills = 0;
            this._shots = 0;
            this._hits = 0;
            this._wave = 0;
            this.pushUI();
        });
    }
    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------
    add(points) {
        this._score = Math.max(0, this._score + points);
        if (this._score > this._highScore) {
            this._highScore = this._score;
            localStorage.setItem(HIGH_SCORE_KEY, String(this._highScore));
        }
        this.pushUI();
    }
    /** Tell UIScene to re-render the HUD with fresh numbers */
    pushUI() {
        this.emitter.emit('ui:score', this.snapshot());
    }
}
