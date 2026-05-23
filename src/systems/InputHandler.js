export class InputHandler {
    emitter;
    pendingFire = false;
    pendingZoom = false;
    zoomActive = false;
    mouseDeltaX = 0;
    mouseDeltaY = 0;
    keys = {};
    constructor(emitter) {
        this.emitter = emitter;
        this.bindEvents();
    }
    update() {
        if (this.mouseDeltaX !== 0 || this.mouseDeltaY !== 0) {
            this.emitter.emit('input:mousemove', this.mouseDeltaX, this.mouseDeltaY);
            this.mouseDeltaX = 0;
            this.mouseDeltaY = 0;
        }
        if (this.pendingFire) {
            this.emitter.emit('input:fire');
            this.pendingFire = false;
        }
        if (this.pendingZoom) {
            this.emitter.emit('input:zoom', this.zoomActive);
            this.pendingZoom = false;
        }
        this.emitter.emit('input:keys', { ...this.keys });
    }
    bindEvents() {
        document.addEventListener('click', () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== document.body)
                return;
            this.mouseDeltaX += e.movementX;
            this.mouseDeltaY += e.movementY;
        });
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0)
                this.pendingFire = true;
            if (e.button === 2) {
                this.zoomActive = true;
                this.pendingZoom = true;
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.zoomActive = false;
                this.pendingZoom = true;
            }
        });
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Tab') {
                e.preventDefault();
                this.emitter.emit('input:toggleOrbit');
            }
            if (e.code === 'KeyR') {
                this.emitter.emit('input:reload');
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    destroy() {
        // In a larger project, store references and removeEventListener here
    }
}
