import { readdirSync, writeFileSync } from "node:fs";
const root = "docs/waves/U4-evidence";
const groups = [
  ["Art, motion pairs, camp phases and failure cases", "screens"],
  ["Every screen and both playable weeks", "tour/screens"],
  ["Retained failed verification attempts", "attempts"],
];
const sections = groups
  .map(
    ([title, folder]) =>
      `<section><h2>${title}</h2><div class="grid">${readdirSync(
        `${root}/${folder}`,
      )
        .filter((f) => f.endsWith(".png"))
        .map(
          (f) =>
            `<a href="${folder}/${f}"><img loading="lazy" src="${folder}/${f}" alt="${f}"><span>${f.replaceAll("-", " ").replace(".png", "")}</span></a>`,
        )
        .join("")}</div></section>`,
  )
  .join("");
writeFileSync(
  `${root}/index.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mage Arena — U4 evidence</title><style>body{margin:3vw;background:#0a151b;color:#d6e1d5;font:18px/1.5 system-ui}h1,h2{font-family:Georgia,serif;color:#d5bf91}a{color:#92ddd0;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px}img{width:100%;height:auto;border:1px solid #405b5b}span{display:block;font-size:15px}section{margin:50px 0}p{max-width:1000px}nav a{margin-right:24px}</style><h1>U4 — Covenant in motion</h1><p>A8 clips, A10 directional bodies and the A11 Tideglass in the game. Open any image at native 1080p/1440p. Motion pairs are two frames of actual atlas playback. Fire/Earth/Air captures are presentation fixtures; Water remains the playable spell catalogue. Ground/rim art is unchanged. The cinder hound remains procedural, and A11 is an authored composite awaiting new paintings.</p><nav><a href="../U4-report.md">Report</a><a href="art-browser.json">Art/performance measurements</a><a href="tour/browser.json">Full screen tour</a><a href="packing.json">Lossless atlas packing</a><a href="audit.json">Hash and determinism audit</a></nav><p>Measured automated evidence; owner motion, readability and feel remain pending. Failed attempts are retained and labelled separately below.</p>${sections}</html>`,
);
console.log("U4 native gallery written");
