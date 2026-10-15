import { expect, it } from "vitest";
import { Container } from "pixi.js";
import { pickQuality } from "./quality.ts";
import { depthOf, orderByDepth, setDepth } from "./depth.ts";
import data from "../data/quality.json" with { type: "json" };

const stick =
  "Mozilla/5.0 (Linux; Android 11; AFTKM Build/RS8182.3811N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.258 Mobile Safari/537.36";
it("picks the TV profile on a Fire TV WebView and keeps desktop elsewhere", () => {
  expect(pickQuality("", stick)).toEqual({ ...data.profiles.tv, name: "tv" });
  expect(pickQuality("", "Mozilla/5.0 (Windows NT 10.0) Chrome/148")).toEqual({
    ...data.profiles.desktop,
    name: "desktop",
  });
});
it("lets ?quality= and ?q.<knob>= override the profile, typed like the data", () => {
  expect(pickQuality("?quality=desktop", stick).name).toBe("desktop");
  const q = pickQuality("?q.maxResolution=1.25&q.antialias=0&q.nope=3", "");
  expect(q.maxResolution).toBe(1.25);
  expect(q.antialias).toBe(false);
  expect("nope" in q).toBe(false);
});
it("orders figures by ground depth, stable, and leaves an ordered layer alone", () => {
  const parent = new Container(),
    [a, b, c] = [new Container(), new Container(), new Container()];
  parent.addChild(a, b, c);
  setDepth(a, 3);
  setDepth(b, 1);
  setDepth(c, 1);
  orderByDepth(parent);
  expect(parent.children).toEqual([b, c, a]);
  expect(depthOf(a)).toBe(3);
  const before = [...parent.children];
  orderByDepth(parent);
  expect(parent.children).toEqual(before);
});
