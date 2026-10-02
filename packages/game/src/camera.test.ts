import { describe, expect, it } from 'vitest';
import { arcPoints, cameraMetrics, clientToGround, contract, depthOrder, groundToScreen, makeCamera, screenToGround } from './camera.ts';
import { addMage, createArena, createGames, idleInput, inArc, resolveHit, segmentHit, stateHash, stepArena } from '@mage/core/arena';

describe('the confirmed camera contract', () => {
  it('pins the owner-approved scale numbers, including 1440p and the full zoom range', () => {
    expect(contract.arena_metres).toEqual([192, 144]);
    expect(contract.minimum_combatant_centre_separation_metres).toBe(6);
    expect(contract.absorb).toMatchObject({ angle_degrees: 140, visual_radius_metres: 2.4, rear_open_degrees: 220 });
    for (const height of [1080, 1440]) for (const d of contract.distances) {
      const c = makeCamera({ width: height * 16 / 9, height }, { x: 12, y: 10 }, d.zoom), m = cameraMetrics(c);
      expect(c.elevation).toBe(55); expect(m.figureHeightPx).toBeCloseTo(height * d.screen_height_fraction, 10);
      expect(m.pxPerMetreX).toBeCloseTo(30 * d.zoom * height / 1080, 10);
      expect(m.pxPerMetreY).toBeCloseTo(m.pxPerMetreX * Math.sin(55 * Math.PI / 180), 10);
      expect(m.outlinePx).toBe(height / 1080 * 3); expect(m.projectileCorePx).toBe(height / 1080 * 4);
    }
    const m = cameraMetrics(makeCamera({ width: 1920, height: 1080 }, { x: 0, y: 0 }));
    expect(m.figureHeightPx).toBeCloseTo(64.8); expect(m.visibleGroundM.x).toBeCloseTo(53.33333333);
    expect(m.visibleGroundM.y).toBeCloseTo(36.62323766); expect(m.pxPerMetreY).toBeCloseTo(29.48947359);
    expect(m.metresPerPixelX).toBeCloseTo(1 / 36); expect(m.metresPerPixelY).toBeCloseTo(1 / 29.48947359);
    expect(cameraMetrics(makeCamera({ width: 2560, height: 1440 }, { x: 0, y: 0 })).figureHeightPx).toBeCloseTo(86.4);
  });
  it('clamps zoom, rejects invalid cameras and does not flatten upright figure height', () => {
    const viewport = { width: 1920, height: 1080 }, centre = { x: 0, y: 0 };
    expect(makeCamera(viewport, centre, 4).zoom).toBe(1.2); expect(makeCamera(viewport, centre, 0).zoom).toBe(0.8);
    expect(() => makeCamera(viewport, centre, NaN)).toThrow(); expect(() => makeCamera({ width: 0, height: 1080 }, centre)).toThrow();
    expect(() => makeCamera(viewport, centre, 1.2, 0)).toThrow();
    expect(() => makeCamera(viewport, centre, 1.2, 90)).toThrow();
    expect(cameraMetrics(makeCamera(viewport, centre, 1.2, 45)).figureHeightPx).toBe(cameraMetrics(makeCamera(viewport, centre, 1.2, 60)).figureHeightPx);
  });
  it('frames all sparse Tiro opening opponents outside the HUD at the approved near distance', () => {
    for (let seed = 0; seed < 100; seed++) for (let wave = 0; wave < 4; wave++) {
      const g = createGames(seed, undefined, wave), camera = makeCamera({ width: 1920, height: 1080 }, g.player.pos);
      for (const actor of g.state.actors) {
        const p = groundToScreen(actor.pos, camera);
        expect(p.x).toBeGreaterThan(24); expect(p.x).toBeLessThan(1896); expect(p.y).toBeGreaterThan(180); expect(p.y).toBeLessThan(840);
      }
    }
  });
  it('round-trips all octants, off-screen points, translated cameras, aspect ratios and elevations', () => {
    for (const width of [1000, 1920, 2560]) for (const height of [720, 1080, 1440]) for (const zoom of [0.8, 1, 1.2]) for (const elevation of [45, 55, 60]) {
      const c = makeCamera({ width, height }, { x: -18.4, y: 72.3 }, zoom, elevation);
      for (const p of [{ x: -100, y: -90 }, { x: 500, y: 170 }, c.centre, ...arcPoints(c.centre, 20, 0, 360, 8)]) {
        const actual = screenToGround(groundToScreen(p, c), c); expect(actual.x).toBeCloseTo(p.x, 10); expect(actual.y).toBeCloseTo(p.y, 10);
      }
    }
  });
  it('inverts CSS scaling and offsets, then remaps a stationary pointer after follow/resize', () => {
    const c = makeCamera({ width: 1920, height: 1080 }, { x: 12, y: 10 });
    const bounds = { left: 37, top: 81, width: 960, height: 540 }, p = { x: 19, y: 2 }, screen = groundToScreen(p, c);
    const client = { x: bounds.left + screen.x / 2, y: bounds.top + screen.y / 2 };
    expect(clientToGround(client, bounds, c).x).toBeCloseTo(p.x); expect(clientToGround(client, bounds, c).y).toBeCloseTo(p.y);
    const moved = makeCamera(c, { x: 20, y: 15 });
    expect(clientToGround(client, bounds, moved).x).toBeCloseTo(p.x + 8); expect(clientToGround(client, bounds, moved).y).toBeCloseTo(p.y + 5);
  });
  it('projects a true 140-degree ward and sorts overlapping bodies by feet with stable ties', () => {
    const arc = arcPoints({ x: 0, y: 0 }, 2.4, 0, 140);
    expect(arc[0]!.x).toBeCloseTo(2.4 * Math.cos(70 * Math.PI / 180)); expect(arc[0]!.y).toBeCloseTo(-2.4 * Math.sin(70 * Math.PI / 180));
    expect(inArc({ x: 1, y: 0 }, arc[0]!, 140)).toBe(true); expect(inArc({ x: 1, y: 0 }, { x: -1, y: 0 }, 140)).toBe(false);
    const c = makeCamera({ width: 1920, height: 1080 }, { x: 0, y: 0 });
    const projected = groundToScreen(arc[0]!, c); expect(projected.x - c.width / 2).toBeCloseTo(arc[0]!.x * 36); expect(projected.y - c.height / 2).toBeCloseTo(arc[0]!.y * 36 * Math.sin(55 * Math.PI / 180));
    expect([{ id: 3, foot: { x: 0, y: 8 } }, { id: 2, foot: { x: 0, y: 4 } }, { id: 1, foot: { x: 8, y: 4 } }].sort(depthOrder).map(v => v.id)).toEqual([1, 2, 3]);
  });
});

describe('W4c: ground-plane aim and hits', () => {
  it('keeps absorb boundaries in ground degrees when an oblique screen compresses their angles', () => {
    for (const zoom of [0.8, 1.2]) for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 4]) for (const offset of [-70.1, -69.9, 69.9, 70.1, 180]) {
      const state = createArena(), p = addMage(state, 0, { x: 12, y: 10 });
      const c = makeCamera({ width: 1920, height: 1080 }, p.pos, zoom);
      const desired = { x: p.pos.x + Math.cos(heading) * 10, y: p.pos.y + Math.sin(heading) * 10 };
      stepArena(state, { [p.id]: { ...idleInput(screenToGround(groundToScreen(desired, c), c)), absorb: true } });
      const angle = heading + offset * Math.PI / 180;
      const hit = resolveHit(state, p, { ownerId: 100, activationId: 100, damage: 14, family: 'magic', tier: 1, source: { x: p.pos.x + Math.cos(angle) * 3, y: p.pos.y + Math.sin(angle) * 3 } });
      expect(hit.perfect).toBe(Math.abs(offset) < 70);
      expect(hit.damage).toBe(Math.abs(offset) < 70 ? 0 : 14);
    }
  });
  it('uses the same ground hit radius at every zoom, resolution, and camera elevation', () => {
    const centre = { x: 12, y: 10 }, a = { x: 4, y: 10 }, b = { x: 20, y: 10 };
    for (const zoom of [0.8, 1, 1.2]) for (const height of [1080, 1440]) for (const elevation of [45, 55, 60]) {
      const c = makeCamera({ width: height * 16 / 9, height }, centre, zoom, elevation);
      const inverse = (p: { x: number; y: number }) => screenToGround(groundToScreen(p, c), c);
      expect(segmentHit(inverse(a), inverse(b), inverse({ x: 12, y: 10.49 }), 0.5)).toBeDefined();
      expect(segmentHit(inverse(a), inverse(b), inverse({ x: 12, y: 10.51 }), 0.5)).toBeUndefined();
    }
  });
  it('fires through projected feet in all eight directions without changing damage or collision geometry', () => {
    for (let direction = 0; direction < 8; direction++) for (const height of [1080, 1440]) for (const zoom of [0.8, 1.2]) {
      const state = createArena(7), player = addMage(state, 0, { x: 12, y: 10 }), angle = direction * Math.PI / 4;
      const target = addMage(state, 1, { x: 12 + Math.cos(angle) * 9, y: 10 + Math.sin(angle) * 9 }); target.dummy = true;
      const camera = makeCamera({ width: height * 16 / 9, height }, player.pos, zoom);
      const aim = screenToGround(groundToScreen(target.pos, camera), camera);
      stepArena(state, { [player.id]: { ...idleInput(aim), cast: true } });
      for (let tick = 0; tick < 120; tick++) stepArena(state);
      expect(target.metrics.hits).toBe(1); expect(target.hp).toBeCloseTo(target.maxHp - 2.05);
    }
  });
  it('rendering cannot mutate simulation, and head-height aiming stays a ground point (no hidden snap)', () => {
    const state = createArena(), player = addMage(state, 0, { x: 12, y: 10 }), target = addMage(state, 1, { x: 21, y: 10 });
    const before = stateHash(state), c = makeCamera({ width: 1920, height: 1080 }, player.pos), foot = groundToScreen(target.pos, c);
    const headGround = screenToGround({ x: foot.x, y: foot.y - cameraMetrics(c).figureHeightPx }, c);
    expect(headGround.y).toBeLessThan(target.pos.y - 2); expect(stateHash(state)).toBe(before);
    stepArena(state, { [player.id]: { ...idleInput(headGround), cast: true } }); for (let i = 0; i < 120; i++) stepArena(state);
    expect(target.metrics.hits).toBe(0);
  });
});
