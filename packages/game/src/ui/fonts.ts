import { BitmapFont, BitmapFontManager, TextStyle } from "pixi.js";
import { art } from "../art.ts";
export const fontDiagnostics: string[] = [];
export let fontTextureBytes = 0;
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
        const r = await fetch(art.base + entry.file, {
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw Error(`Font ${name}: ${r.status}`);
        const bytes = await r.arrayBuffer();
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        if (digest !== entry.sha256) throw Error(`Font hash: ${name}`);
        const face = new FontFace(family!, bytes, {
          weight: family === "CovenantTitle" ? "600" : "400",
        });
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
        style: {
          fontFamily: resolved,
          fontSize: 64,
          fill: 0xffffff,
          fontWeight: family === "CovenantTitle" ? "600" : "400",
        },
        chars: [[" ", "~"], ["\u00a0", "\u017f"], "…—–‘’“”•→←↑↓✦◆○"],
        resolution: 2,
        padding: 4,
      });
      const font = BitmapFontManager.getFont(
        "Mage Arena",
        new TextStyle({ fontFamily: family }),
      );
      fontTextureBytes += font.pages.reduce(
        (n, p) =>
          n + p.texture.source.pixelWidth * p.texture.source.pixelHeight * 4,
        0,
      );
    }
  })());
}
