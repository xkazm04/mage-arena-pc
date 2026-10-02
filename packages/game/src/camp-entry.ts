import "./style.css";
import type { CampCommand } from "@mage/director";
import { CampAssets } from "./assets.ts";
import { CampScenes, type Presentation, type Scene } from "./scenes.ts";
import { ParleyPanel } from "./parley-panel.ts";

import { seasonPanel } from "./season-panel.ts";
import type { SeasonView as View } from "./season-api.ts";
export async function mountCamp(root: HTMLElement, enterArena: () => void = () => {}): Promise<() => void> {
const lifetime = new AbortController();
let disposed = false;
const listen = <K extends keyof WindowEventMap>(type: K, handler: (e: WindowEventMap[K]) => void) => window.addEventListener(type, handler, { signal: lifetime.signal });
let poll: number | undefined;
root.innerHTML = `<div class="loading"><p class="eyebrow">Mage Arena</p><h1>Beyond the closed grille</h1><p>Entering Castra Clausa…</p></div>`;
const ui: Presentation = {
  scene: "map",
  selected: "tent",
  page: 0,
  selectedCard: -1,
  read: new Set(),
};
let view: View,
  busy = false,
  pollBusy = false,
  lane = 0,
  held = false;
const assets = new CampAssets();
const scenes = new CampScenes(assets, select, selectCard, selectLane);
const parley = new ParleyPanel(async (input, revision) => {
  busy = true;
  renderSide();
  try {
    view = await api<View>("parley", { input, revision });
    ui.scene = "visit";
    render();
    return view;
  } finally {
    busy = false;
    render();
  }
});
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
async function api<T>(path: string, body?: unknown): Promise<T> {
  if (disposed) throw new Error("Scene closed");
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (disposed) throw new Error("Scene closed");
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(result.error ?? "The camp is out of reach.");
  return result;
}
function toast(message: string) {
  const el = root.querySelector(".toast")!;
  el.textContent = message;
  window.setTimeout(() => {
    if (el.textContent === message) el.textContent = "";
  }, 6000);
}
function select(id: string) {
  ui.selected = id;
  render();
}
function setScene(scene: Scene) {
  ui.scene = scene;
  ui.page = 0;
  ui.selectedCard = -1;
  render();
}
function selectCard(index: number) {
  ui.selectedCard = index;
  const card =
    ui.scene === "board" ? view.board[index]?.factId : view.journal[index]?.id;
  if (card) ui.read.add(card);
  render();
}
function selectLane(index: number) {
  lane = Math.max(0, Math.min(view.listeningRules.lanes - 1, index));
  void control();
}
async function control() {
  if (!view.listening || view.nightFinished) return;
  try {
    await api("input", { lane, listening: held, day: view.day.day });
  } catch {
    held = false;
  }
}
async function command(command: CampCommand) {
  if (busy) return;
  busy = true;
  renderSide();
  try {
    const oldSlot = view.slot;
    view = await api<View>("command", { revision: view.revision, command });
    if (command.type === "travel") {
      ui.selected = view.location;
      ui.scene = "visit";
    }
    if (command.type === "listen") {
      ui.scene = "listen";
      lane = 0;
      held = false;
    }
    if (command.type === "dawn") {
      setScene("board");
      toast("First light. The camp remembers yesterday.");
    } else if (oldSlot !== view.slot) {
      ui.scene = "map";
      ui.selected = view.location;
      toast(
        `${view.slot === "night" ? "The lanterns are lit" : "The light is fading"}. Choose how to spend ${view.slot}.`,
      );
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : "Try that action again.");
    try {
      view = await api<View>("session");
    } catch {
      /* Keep the last readable view. */
    }
  } finally {
    busy = false;
    render();
  }
}
function render() {
  if (disposed) return;
  root.querySelector(".eyebrow")!.textContent =
    `MAGE ARENA / WEEK ${view.day.week} / DAY ${view.day.day}`;
  root.querySelector(".slots")!.innerHTML = ["day", "dusk", "night"]
    .map(
      (slot) =>
        `<span class="${view.slot === slot ? "current" : ""}" ${view.slot === slot ? 'aria-current="step"' : ""}>${slot[0].toUpperCase() + slot.slice(1)}</span>`,
    )
    .join("");
  root.querySelector(".stats")!.innerHTML =
    `<strong>${escape(view.player.name)}</strong> · ${escape(view.player.school)}<br>${view.player.gold} gold · ${view.season.renown} renown · ${view.player.fatigue} fatigue · ${view.budget} time left`;
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-scene]"))
    b.classList.toggle("active", b.dataset.scene === ui.scene);
  root.querySelector(".board-count")!.textContent = String(
    view.board.filter((c) => !ui.read.has(c.factId)).length,
  );
  root.querySelector(".scene-note")!.textContent = view.ended
    ? "The season is complete. Endings arrive in a later chapter."
    : view.player.stocks
      ? "The Vigil keeps you in the stocks. Rest or wait for release."
      : view.day.games
        ? "Games day · the arena chapter joins this season in the integration wave."
        : view.day.eve
          ? "Games eve · the Tent Trials are on the calendar."
          : `${view.budget} time remaining · travel uses time · one activity ends this slot`;
  const weeks = Array.from(
    { length: 6 },
    (_, w) =>
      `<div><div class="week-label">WEEK ${w + 1}</div><div class="days">${view.calendar
        .filter((d) => d.week === w + 1)
        .map(
          (d) =>
            `<div class="day ${d.day < view.day.day ? "past" : ""} ${d.day === view.day.day ? "today" : ""} ${d.games ? "games" : ""} ${d.eve ? "eve" : ""}" title="Day ${d.day}${d.games ? " · Games" : d.eve ? " · Tent Trial" : ""}" ${d.day === view.day.day ? 'aria-current="date"' : ""}>${d.day}</div>`,
        )
        .join("")}</div></div>`,
  );
  root.querySelector(".weeks")!.innerHTML = weeks.join("");
  renderSide();
  scenes.draw(view, ui);
}
function renderSide() {
  if (disposed) return;
  const side = root.querySelector<HTMLElement>(".side")!;
  const disabled = busy || view.settling || view.parley.pending || view.ended;
  let content: string;
  if (ui.scene === "map") {
    const place = view.places.find((p) => p.id === ui.selected)!;
    const canTravel =
      !disabled &&
      !view.listening &&
      !view.nightFinished &&
      place.isOpen &&
      place.cost <= view.budget &&
      !view.player.stocks;
    content = `<p class="eyebrow">WITHIN THE WARDS</p><h2>${escape(place.name)}</h2><p>${escape(place.description)}</p><p class="meta">Open: ${place.open.join(" / ")}<br>${place.id === view.location ? "You are here" : `${place.cost} travel time`} · an activity needs ${view.actionCost} time</p><button class="primary" data-visit ${canTravel || place.id === view.location ? "" : "disabled"}>${place.id === view.location ? "Visit this place" : `Travel & visit · ${place.cost} time`}</button><h3>The eight places</h3><div class="place-grid">${view.places.map((p) => `<button data-place="${p.id}" class="${p.id === ui.selected ? "active" : ""}">${escape(p.name)}<small>${p.id === view.location ? "You are here" : p.isOpen ? `${p.cost} time to reach` : `Opens ${p.open.join(" / ")}`}</small></button>`).join("")}</div>`;
  } else if (ui.scene === "visit") {
    const place = view.places.find((p) => p.id === view.location)!;
    content = `<p class="eyebrow">${view.slot.toUpperCase()} / A MOMENT HERE</p><h2>${escape(place.name)}</h2><p>${escape(place.description)}</p><div class="people">${view.presence.map((p) => `<span class="person">${escape(p.name)}</span>`).join("")}</div><p class="meta">Choose an activity. It ends this time slot.</p>`;
    if (
      view.slot === "night" &&
      view.location === "tent" &&
      !view.listening &&
      !view.nightFinished &&
      view.budget >= view.actionCost &&
      !view.player.stocks
    )
      content += `<button class="action" data-command="listen" ${disabled ? "disabled" : ""}><strong>Listen at the tent flap</strong><small>Follow the voices and avoid the Vigil. A Knowing may reach your journal.</small></button>`;
    content += view.parley.moments
      .map(
        (m) =>
          `<button class="action knowing-action" data-parley-target="${m.target}" ${disabled ? "disabled" : ""}><strong>A Knowing moment · ${escape(m.name)}</strong><small>${escape(m.cards[0].knowing)}</small></button>`,
      )
      .join("");
    content += view.actions
      .map(
        (a, i) =>
          `<button class="action" data-action="${i}" ${disabled ? "disabled" : ""}><strong>${escape(a.label)}</strong><small>${escape(a.gains)}</small></button>`,
      )
      .join("");
    if (!view.actions.length && !view.listening)
      content += `<p class="notice">${place.isOpen ? "There is no available activity here just now. You can travel elsewhere or let the slot pass." : "This place has closed. Choose another place on the map."}</p>`;
  } else if (ui.scene === "listen") {
    const n = view.listening;
    content = `<p class="eyebrow">AFTER THE LANTERNS</p><h2>Listen at the flap</h2><p>Move to the voices. Hold Listen to gather a fragment. Release it when the patrol reaches your cover.</p><div class="place-grid">${Array.from({ length: view.listeningRules.lanes }, (_, i) => `<button data-lane="${i}" class="${n?.lane === i ? "active" : ""}" ${n?.done ? "disabled" : ""}>Cover ${i + 1}</button>`).join("")}</div><button class="primary listen-hold" ${n?.done ? "disabled" : ""}>Hold Listen · Space</button><p class="meta">A / D or 1–3 to move · release Space to hide</p><hr><p><strong data-clues>${n?.clues ?? 0} / ${view.listeningRules.requiredClues}</strong> fragments heard<br><strong data-alerts>${n?.alerts ?? 0}</strong> moments exposed to the Vigil</p>`;
    if (n?.done)
      content += `<p class="notice">${n.learned ? "You caught a private Knowing. It is waiting in your journal." : "The camp has gone quiet. No new Knowing tonight."}</p>`;
  } else {
    const cards =
      ui.scene === "board"
        ? view.board.map((b) => ({ id: b.factId, text: b.text }))
        : view.journal;
    content = `<p class="eyebrow">${ui.scene === "board" ? "AT FIRST LIGHT" : "FOR YOUR EYES"}</p><h2>${ui.scene === "board" ? "The Hollow Board" : "Your journal"}</h2><p>${ui.scene === "board" ? "Public deeds and witnessed moments. A rumour remains a rumour." : "What you have learned stays here. Choose carefully who gets to hear it."}</p><div class="card-list">${cards
      .slice(ui.page * 6, ui.page * 6 + 6)
      .map(
        (c, i) =>
          `<button data-card="${ui.page * 6 + i}" class="${ui.selectedCard === ui.page * 6 + i ? "active" : ""}">${escape(c.text)}</button>`,
      )
      .join("")}</div>`;
    if (cards.length > 6)
      content += `<div class="page-controls"><button data-page="-1" ${ui.page === 0 ? "disabled" : ""}>Previous</button><span>${ui.page + 1} / ${Math.ceil(cards.length / 6)}</span><button data-page="1" ${(ui.page + 1) * 6 >= cards.length ? "disabled" : ""}>Next</button></div>`;
  }
  if (view.listening && !view.listening.done && ui.scene !== "listen")
    content += `<button class="primary" data-resume>Return to the voices</button>`;
  else if (view.nightFinished)
    content += `<hr><button class="primary" data-command="dawn" ${disabled ? "disabled" : ""}>${busy || view.settling ? "The camp stirs…" : "Meet the morning"}</button><p class="meta">${busy || view.settling ? "The last footsteps fade. Your journal is still here to read." : "Leave the night behind and read the Hollow Board."}</p>`;
  else if (!view.listening && !view.ended)
    content += `<hr><button class="secondary" data-command="wait" ${disabled ? "disabled" : ""}>${view.slot === "night" ? "Let the night pass" : `Let ${view.slot} pass`}</button>`;
  side.innerHTML = content;
  seasonPanel(side, view, next => { view = next; render(); }, enterArena);
  for (const b of side.querySelectorAll<HTMLButtonElement>(
    "[data-parley-target]",
  ))
    b.onclick = () => {
      const moment = view.parley.moments.find(
        (m) => m.target === b.dataset.parleyTarget,
      );
      if (moment) parley.open(moment, view);
    };
  side
    .querySelector<HTMLButtonElement>("[data-visit]")
    ?.addEventListener("click", () => {
      if (ui.selected === view.location) setScene("visit");
      else void command({ type: "travel", place: ui.selected });
    });
  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-place]"))
    b.onclick = () => select(b.dataset.place!);
  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-action]"))
    b.onclick = () =>
      void command({
        type: "act",
        action: view.actions[Number(b.dataset.action)].id,
      });
  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-command]"))
    b.onclick = () =>
      void command({ type: b.dataset.command as "wait" | "listen" | "dawn" });
  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-card]"))
    b.onclick = () => selectCard(Number(b.dataset.card));
  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-page]"))
    b.onclick = () => {
      ui.page += Number(b.dataset.page);
      render();
    };
  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-lane]"))
    b.onclick = () => selectLane(Number(b.dataset.lane));
  side
    .querySelector<HTMLButtonElement>("[data-resume]")
    ?.addEventListener("click", () => setScene("listen"));
  const hold = side.querySelector<HTMLButtonElement>(".listen-hold");
  hold?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    held = true;
    void control();
  });
}
async function boot() {
  await Promise.all([
    assets.load(),
    api<View>("session").then((v) => {
      view = v;
    }),
  ]);
  root.innerHTML = `<header><div><p class="eyebrow"></p><h1>Castra Clausa</h1></div><nav class="slots" aria-label="Time of day"></nav><div class="stats"></div></header><main class="workspace"><section class="left"><nav class="toolbar" aria-label="Camp screens"><button data-scene="map">Season map</button><button data-scene="board">Hollow Board <span class="board-count"></span></button><button data-scene="journal">Private journal</button><span class="spacer"></span></nav><div class="scene"></div><div class="scene-note"></div></section><aside class="side" aria-label="Camp actions"></aside></main><footer class="season"><div class="season-heading"><p class="eyebrow">ONE SEASON / SIX WEEKS</p><p>• Tent Trial on the eve · terracotta marks the Games</p></div><div class="weeks" aria-label="Season calendar"></div></footer><div class="toast" role="status" aria-live="polite"></div>`;
  await scenes.init(root.querySelector(".scene")!);
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-scene]"))
    b.onclick = () => setScene(b.dataset.scene as Scene);
  ui.selected = view.location;
  if (view.listening) {
    ui.scene = "listen";
    lane = view.listening.lane;
  }
  render();
  listen("keydown", (e) => {
    if (
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLInputElement ||
      ui.scene !== "listen" ||
      !view.listening ||
      view.listening.done
    )
      return;
    if (
      ["Space", "KeyA", "KeyD", "Digit1", "Digit2", "Digit3"].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    if (e.code === "Space") {
      held = true;
      void control();
    } else if (e.code === "KeyA") selectLane(lane - 1);
    else if (e.code === "KeyD") selectLane(lane + 1);
    else if (/^Digit[123]$/.test(e.code)) selectLane(Number(e.code.at(-1)) - 1);
  });
  const release = () => {
    if (held) {
      held = false;
      void control();
    }
  };
  listen("keyup", (e) => {
    if (e.code === "Space") release();
  });
  listen("pointerup", release);
  listen("pointercancel", release);
  listen("blur", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) release();
  }, { signal: lifetime.signal });
  poll = window.setInterval(async () => {
    if (pollBusy) return;
    pollBusy = true;
    try {
      const next = await api<View>("session");
      if (
        !busy &&
        (next.revision !== view.revision ||
          next.settling !== view.settling ||
          next.parley.pending !== view.parley.pending)
      ) {
        const ended = !view.nightFinished && next.nightFinished;
        view = next;
        if (ui.scene === "listen" && !ended) {
          scenes.draw(view, ui);
          root.querySelector("[data-clues]")!.textContent =
            `${view.listening!.clues} / ${view.listeningRules.requiredClues}`;
          root.querySelector("[data-alerts]")!.textContent = String(
            view.listening!.alerts,
          );
          for (const button of root.querySelectorAll<HTMLButtonElement>(
            "[data-lane]",
          ))
            button.classList.toggle(
              "active",
              Number(button.dataset.lane) === view.listening!.lane,
            );
          /* Preserve held pointer and keyboard focus. */
        } else render();
      }
    } catch {
      /* Next poll reconnects without dropping the readable scene. */
    } finally {
      pollBusy = false;
    }
  }, 100);
  document.body.dataset.ready = "true";
}
await boot();
return () => { disposed = true; lifetime.abort(); clearInterval(poll); scenes.dispose(); parley.dialog.remove(); root.replaceChildren(); delete document.body.dataset.ready; };
}
