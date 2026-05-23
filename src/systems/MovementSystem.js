export class MovementSystem {
    targets = new Set();
    register(target) {
        this.targets.add(target);
    }
    unregister(target) {
        this.targets.delete(target);
    }
    update(delta) {
        this.targets.forEach((target) => {
            if (!target.isDead) {
                target.update(delta);
            }
        });
    }
    clear() {
        this.targets.clear();
    }
}
