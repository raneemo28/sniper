import { Target } from '../components/Target';

export class MovementSystem {
  private targets: Set<Target> = new Set();

  register(target: Target): void {
    this.targets.add(target);
  }

  unregister(target: Target): void {
    this.targets.delete(target);
  }

  update(delta: number): void {
    this.targets.forEach((target) => {
      if (!target.isDead) {
        target.update(delta);
      }
    });
  }

  clear(): void {
    this.targets.clear();
  }
}
