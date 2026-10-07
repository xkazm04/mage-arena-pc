import { readFileSync, writeFileSync } from "node:fs";
const directory="docs/waves/U3-evidence";
const report=JSON.parse(readFileSync(`${directory}/browser.json`,"utf8")) as { screens:{filename:string}[] };
writeFileSync(`${directory}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>U3 · Hours in camp</title>
<style>body{background:#0b151b;color:#e4e7d5;font:18px system-ui;margin:3vw}h1{color:#79d7cb}a{color:#dbc18a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:26px}figure{margin:0}img{width:100%;border:1px solid #607e77}figcaption{padding:12px}p{max-width:1000px}</style>
<h1>U3 · Hours in camp</h1><p>Measured browser captures at 1080p and 1440p. Place names only, free travel, a daily rune dial and header stats. Open a capture for native resolution. Both complete two-week routes and exact saves pass; visual comfort and hour pacing await owner play.</p>
<p><a href="browser.json">Browser evidence</a> · <a href="replay-save.json">Deterministic replay</a> · <a href="../U3b-camp-ui.md">Design note</a></p><main>
${report.screens.map(s=>`<figure><a href="screens/${s.filename}"><img loading="lazy" src="screens/${s.filename}" alt="${s.filename}"></a><figcaption>${s.filename}</figcaption></figure>`).join("\n")}</main></html>`);
console.log(`U3 gallery: ${report.screens.length} captures`);
