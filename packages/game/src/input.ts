import { idleInput, type InputFrame, type Vec } from '@mage-arena/core/arena';
import { clientToGround, type Camera } from './camera';
export class ArenaInput {
  readonly keys = new Set<string>();
  aim: Vec = { x: 23, y: 10 };
  cast = false; absorb = false; slot = 0;
  private pointer?: Vec;
  private rollQueued = false;
  private castQueued = false;
  constructor(private canvas: HTMLCanvasElement, private camera: () => Camera) {
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).matches('input,select,textarea,button')) return;
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) this.rollQueued = true;
      if (/^Digit[1-4]$/.test(e.code)) this.slot = Number(e.code.slice(-1)) - 1;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    canvas.addEventListener('pointermove', e => this.point(e));
    canvas.addEventListener('pointerdown', e => {
      this.point(e); if (e.button === 0) { this.cast = true; this.castQueued = true; } if (e.button === 2) this.absorb = true;
      canvas.setPointerCapture(e.pointerId); canvas.focus(); e.preventDefault();
    });
    window.addEventListener('pointerup', e => { if (e.button === 0) this.cast = false; if (e.button === 2) this.absorb = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.slot = (this.slot + Math.sign(e.deltaY) + 4) % 4; }, { passive: false });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
  }
  private point(e: PointerEvent): void {
    this.pointer = { x: e.clientX, y: e.clientY }; this.refreshAim();
  }
  refreshAim(): void {
    if (this.pointer) this.aim = clientToGround(this.pointer, this.canvas.getBoundingClientRect(), this.camera());
  }
  clear(): void { this.keys.clear(); this.cast = false; this.absorb = false; this.rollQueued = false; this.castQueued = false; }
  frame(): InputFrame {
    this.refreshAim();
    const frame = { ...idleInput(this.aim), slot: this.slot, cast: this.cast || this.castQueued, absorb: this.absorb,
      move: { x: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')), y: Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW')) },
      roll: this.keys.has('Space') || this.rollQueued, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
    this.rollQueued = false; this.castQueued = false;
    return frame;
  }
}
