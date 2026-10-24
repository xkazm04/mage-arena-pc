import { combat } from "@mage/core/arena";

/**
 * One replay transport for the Lab's ring and the results card's "Read the bout": an integer position over
 * [first, last], play at the simulation rate, step either way, seek. The owner renders; `moved` hears each
 * position change (from, to) so it can derive its shown state once per move instead of once per frame.
 */
export class ReplayTransport {
  playing = false;
  private carry = 0;
  constructor(
    readonly first: number,
    readonly last: number,
    public position = first,
    private moved: (to: number, from: number) => void = () => {},
  ) {}
  /** Clamped, rounded; false when the position did not change. */
  seek(position: number) {
    const p = Math.max(this.first, Math.min(this.last, Math.round(position)));
    if (p === this.position) return false;
    const from = this.position;
    this.position = p;
    this.moved(p, from);
    return true;
  }
  step(count: number) {
    this.playing = false;
    this.seek(this.position + count);
  }
  /** Play / pause; a played-out replay restarts from its first frame. */
  toggle() {
    if (!this.playing && this.position >= this.last) this.seek(this.first);
    this.playing = !this.playing;
  }
  advance(dt: number) {
    if (!this.playing) return;
    this.carry += dt * combat.simStepHz;
    for (; this.carry >= 1 && this.position < this.last; this.carry--)
      this.seek(this.position + 1);
    if (this.position >= this.last) this.playing = false;
    if (!this.playing) this.carry = 0;
  }
}
