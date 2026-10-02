import { describe, expect, it } from 'vitest';
import { nextFocus, viewportLayout } from './layout.ts';
import { requiredRegions, validateAtlas } from './kit.ts';
describe('canvas UI contracts',()=>{
  it('preserves a five percent safe rectangle at 1080p and 1440p',()=>{
    for(const h of [1080,1440]){const l=viewportLayout(h*16/9,h);expect(l.safe.x*l.scale).toBeCloseTo(h*16/9*.05);expect(l.safe.y*l.scale).toBeCloseTo(h*.05);expect(l.x).toBe(0);expect(l.y).toBe(0);}
  });
  it('navigates spatially, skips disabled controls and wraps tab order',()=>{
    const items=[{id:'a',x:0,y:0,w:100,h:60},{id:'blocked',x:110,y:0,w:100,h:60,disabled:true},{id:'b',x:220,y:0,w:100,h:60},{id:'c',x:0,y:100,w:100,h:60}];
    expect(nextFocus(items,'a','right')).toBe('b');expect(nextFocus(items,'a','down')).toBe('c');expect(nextFocus(items,'c','next')).toBe('a');expect(nextFocus(items,'a','previous')).toBe('c');expect(nextFocus(items,'deleted','down')).toBe('a');
  });
  it('rejects corrupt atlas geometry before creating any textures',()=>{
    const frame={page:'a',rect:[0,0,100,100],anchor:[0,0],nineSlice:[12,12,12,12]};
    const valid={schemaVersion:1,designSize:[1920,1080],pages:[{id:'a',file:'a.png',size:[128,128],sha256:'a'.repeat(64)}],regions:Object.fromEntries(requiredRegions.map(id=>[id,frame]))};expect(validateAtlas(valid)).toEqual(valid);
    for(const rect of [[-1,0,10,10],[0,0,0,10],[0,0,10,10],[NaN,0,10,10],[100,0,100,100]])expect(()=>validateAtlas({...valid,regions:{...valid.regions,'panel.body':{...frame,rect}}})).toThrow();
    expect(()=>validateAtlas({...valid,regions:{}})).toThrow('Missing required');
  });
});
