export class EventEmitter {
    listeners = new Map();
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
    }
    off(event, listener) {
        this.listeners.get(event)?.delete(listener);
    }
    emit(event, ...args) {
        this.listeners.get(event)?.forEach(listener => listener(...args));
    }
    clear() {
        this.listeners.clear();
    }
}
