import { BitmapFont } from "pixi.js";
import { art } from "../art.ts";
export const fontDiagnostics: string[] = [];
let installed: Promise<void> | undefined;
export function installFonts(): Promise<void> {
  return (installed ??= (async () => {
    for (const [family, name, fallback] of [
      ["CovenantBody", "Source Sans 3", "AlegreyaSans-Regular.ttf"],
      ["CovenantTitle", "Cinzel", "Cinzel.ttf"],
    ]) {
      let resolved = family!;
      try {
        const entry = art.manifest?.entries[`font.${name}`];
        if (!entry) throw Error(`Missing ${name}`);
        const r = await fetch(art.base + entry.file);
        if (!r.ok) throw Error(`Font ${name}: ${r.status}`);
        const bytes = await r.arrayBuffer();
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        if (digest !== entry.sha256) throw Error(`Font hash: ${name}`);
        const face = new FontFace(family!, bytes);
        await face.load();
        document.fonts.add(face);
      } catch (e) {
        fontDiagnostics.push(String(e));
        try {
          const face = new FontFace(family!, `url(/fonts/${fallback})`);
          await face.load();
          document.fonts.add(face);
        } catch {
          resolved = family === "CovenantTitle" ? "serif" : "sans-serif";
        }
      }
      BitmapFont.install({
        name: family,
        style: { fontFamily: resolved, fontSize: 64, fill: 0xffffff },
        chars: [[" ", "~"], ["\u00a0", "\u017f"], "…—–‘’“”•→←↑↓✦◆○"],
        resolution: 2,
        padding: 4,
      });
    }
  })());
}
