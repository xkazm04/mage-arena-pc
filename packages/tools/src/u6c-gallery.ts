import { readdirSync, writeFileSync } from "node:fs";
const root = "docs/waves/U6c-evidence";
const files = ["screens", "performance/screens"]
  .flatMap((dir) =>
    readdirSync(`${root}/${dir}`)
      .filter((f) => f.endsWith(".png"))
      .map((f) => `${dir}/${f}`),
  )
  .sort();
const figures = files
  .map((file) => {
    const name = file.split("/").at(-1)!.replace(".png", "");
    const fallback =
      /(?:mire_maw|thornback)-(?:corpse|collapse)-(?:ne|nw)$/.test(name);
    return `<figure data-name="${name}" data-size="${name.slice(0, 4)}"><a href="${file}"><img loading="lazy" src="${file}" alt="${name}"></a><figcaption>${name.replaceAll("_", " ")}${fallback ? " — missing rear view; same-creature front pair" : ""}</figcaption></figure>`;
  })
  .join("\n");
writeFileSync(
  `${root}/index.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>U6c native evidence</title>
<style>body{background:#13181b;color:#e6e1d0;font:18px system-ui;margin:28px}a{color:#8dd4d0}nav{display:flex;gap:18px;flex-wrap:wrap}label{display:inline-block;margin:20px 24px 20px 0}input,select{font:inherit;padding:8px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:24px}figure{margin:0}img{width:100%;aspect-ratio:16/9}figcaption{padding:8px;overflow-wrap:anywhere}[hidden]{display:none}</style>
<h1>U6c: reactions, collapse and persistent corpses</h1><p>${files.length} native captures. Click an image for the full 1920×1080 or 2560×1440 PNG. Technical evidence; owner art/feel acceptance remains open.</p>
<nav><a href="../U6c-report.md">Report and exact missing-art table</a><a href="browser.json">Reaction and Lab checks</a><a href="performance/browser.json">Extra clips, frame time and memory</a><a href="extra-audit.json">46 extra clips</a><a href="verification.json">Hashes and unchanged simulation</a></nav>
<label>Resolution <select id="size"><option value="">Both</option>1080</option>1440</select></label><label>Filter <input id="filter" placeholder="e.g. hound, collapse, nw, setup"></label>
<p>Collapse/corpse pairs cover every roster entity in every direction. Maw/Thornback rear corpse captures intentionally show the same-creature front fallback. Creature Lab targets are stationary; live-input captures use real mouse casting. Extra clips and the stress scene are in the performance group.</p><main>${figures}</main>
<script>const size=document.querySelector('#size'),filter=document.querySelector('#filter');function update(){for(const f of document.querySelectorAll('figure'))f.hidden=!!(size.value&&f.dataset.size!==size.value)||!f.dataset.name.includes(filter.value.trim().toLowerCase().replaceAll(' ','_'));}size.onchange=filter.oninput=update;</script></html>\n`,
);
console.log(
  JSON.stringify({ gallery: `${root}/index.html`, screenshots: files.length }),
);
