export class Player {
  private timer: number | null = null;

  constructor(
    private readonly intervalMs: () => number,
    private readonly tick: () => boolean,
    private readonly onFinish: () => void,
  ) {}

  private schedule(): void {
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.tick()) {
        this.schedule();
      } else {
        this.onFinish();
      }
    }, this.intervalMs());
  }

  start(): void {
    if (this.timer !== null) {
      throw new Error('Player is already running');
    }
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }
}
