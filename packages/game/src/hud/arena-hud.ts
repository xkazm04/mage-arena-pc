// The arena HUD (extracted from arena-entry.ts, D3 4.2): vitals, the slot bar, the school meter, the collar clock and
// the cast readouts. Slots, prices, cooldowns, the meter and the heading follow the school the player's kernel plays
// (school-hud.ts); a Water player sees the HUD as before.
import type { BitmapText, Graphics } from "pixi.js";
import {
  agilityRank,
  flowMark,
  runtime,
  seconds,
  tuningFor,
  type Actor,
  type ArenaState,
  type FlowMark,
  type Games,
} from "@mage/core/arena";
import { frameGraphics } from "../pixi-fixes.ts";
import { sigil } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import { columns } from "../ui/anchors.ts";
import type { CanvasUI } from "../ui/ui.ts";
import {
  flowTipText,
  hexColour,
  nextFlowTip,
  type FlowTip,
  type PerfectGain,
} from "../combat-readout.ts";
import { collarClock } from "../rival-collar.ts";
import feedbackData from "../../data/combat-feedback.json" with { type: "json" };
import type { LabSession } from "../lab-setup.ts";
import {
  flowLine,
  heroName,
  hudSchool,
  maxSpellRank,
  resourceMeter,
  showsRanks,
  slotCount,
  slotView,
} from "./school-hud.ts";
import { runeMeter } from "./rune-meter.ts";
import { hudAnchors } from "./hud-anchors.ts";

/** What the HUD reads from (and the few HUD fields it writes back to) the arena game. */
export interface HudHost {
  readonly training: { state: ArenaState; player: Actor };
  readonly mode: "training" | "roster" | "tiro" | "lab";
  readonly lab?: LabSession;
  readonly games?: Games;
  readonly practice?: unknown;
  readonly input: { slot: number };
  readonly settings: () => void;
  endPractice(): void;
  lastPerfect: number;
  lastGain?: PerfectGain;
  flowTip: FlowTip;
  flowSeen?: { player: object; mark: FlowMark };
}

const runes = ["", "I", "II", "III", "IV"];
/** The build's name: a Fire/Air loadout (an authored rival build drops its `build:` prefix) or the Water composition. */
const buildName = (a: Actor): string =>
  (a.schoolState?.loadout.name ?? a.water.composition.name)
    .replace(/^build:/, "")
    .replaceAll("_", " ")
    .toUpperCase();
/** The slot bar's span: Water's four slots keep their 244 px; five Fire/Air slots share the same width. */
const slotSpan = { x: 524, w: 1040 };

/** Builds the arena HUD on a fresh `arena` screen and returns its per-frame update. The caller ends the screen. */
export function arenaHud(u: CanvasUI, game: HudHost): () => void {
  const p = game.training.player,
    school = hudSchool(p);
  u.begin("arena");
  u.onBack = game.settings;
  const { dl, dr } = hudAnchors(u.edges);
  u.text(
    game.practice
      ? `PRACTICE  /  BOUT ${(game.games?.wave ?? 0) + 1} TAKEN OVER  /  NOTHING IS SENT, SAVED OR PAID`
      : game.mode === "tiro"
        ? `TIRO GAMES  /  BOUT ${(game.games?.wave ?? 0) + 1} OF 4`
        : game.lab
          ? "COMBAT FEEL LAB"
          : "THE PROVING GROUND",
    96 + dl,
    58,
    24,
    colours.gold,
  );
  const heading = u.text(
    game.mode === "tiro" ? "The collar opens" : heroName[school],
    96 + dl,
    94,
    36,
    colours.text,
    700,
    true,
  );
  const build = u.text("", 96 + dl, 142, 24, colours.muted, 900);
  u.button("pause", "Pause", 1644 + dr, 54, 180, 68, game.settings, {
    tooltip: "Escape / Start opens pause and settings.",
  });
  if (game.practice)
    u.button(
      "end-practice",
      "End practice",
      1524 + dr,
      140,
      300,
      68,
      () => game.endPractice(),
      {
        tooltip:
          "Back to the results. The settled bout and its receipt are unchanged.",
      },
    );
  u.panel(96 + dl, 806, 400, 220);
  const hp = u.bar(
      "VITALITY",
      132 + dl,
      834,
      328,
      p.hp,
      p.maxHp,
      colours.danger,
    ),
    mana = u.bar("MANA", 132 + dl, 892, 328, p.mana, p.maxMana, colours.water),
    stamina = u.bar(
      "STAMINA",
      132 + dl,
      950,
      328,
      p.stamina,
      p.maxStamina,
      colours.gold,
    );
  const count = slotCount(school),
    slots =
      count === 4
        ? [0, 1, 2, 3].map((i) => ({ x: 524 + i * 260, w: 244 }))
        : columns(slotSpan, count, 12);
  const labels: BitmapText[] = [],
    detail: BitmapText[] = [],
    repeats: BitmapText[] = [],
    masks: Graphics[] = [],
    slotFrames: Graphics[] = [],
    pips: Graphics[] = [],
    cooldownBars: ((value: number | null) => void)[] = [];
  for (let i = 0; i < count; i++) {
    const { x, w } = slots[i]!,
      y = 854;
    u.button(
      `slot-${i}`,
      "",
      x,
      y,
      w,
      172,
      () => {
        game.input.slot = i;
      },
      { kind: "slot", fontSize: 24 },
    );
    u.icon(
      slotView(p, i, game.training.state)?.icon ?? school,
      x + 42,
      y + 41,
      24,
    );
    // Five Fire/Air slots are narrower: their names step down a size so one word fits a line.
    labels.push(
      count === 4
        ? u.text("", x + 70, y + 24, 26, colours.text, w - 94)
        : u.text("", x + 68, y + 22, 22, colours.text, w - 78),
    );
    u.text(String(i + 1), x + 31, y + 92, 24, colours.gold, 34);
    cooldownBars.push(u.progress("cooldown", x + 76, y + 96, w - 98, 20));
    detail.push(u.text("", x + 28, y + 122, 23, colours.muted, w - 34));
    repeats.push(
      u.text(
        feedbackData.slotPrice.repeat,
        x + 76,
        y + 94,
        20,
        hexColour(feedbackData.slotPrice.repeatFill),
        160,
      ),
    );
    const mask = frameGraphics();
    u.content.addChild(mask);
    masks.push(mask);
    const frame = frameGraphics();
    u.content.addChild(frame);
    slotFrames.push(frame);
    const pip = frameGraphics();
    u.content.addChild(pip);
    pips.push(pip);
  }
  u.panel(1584 + dr, 866, 240, 160);
  const meter = resourceMeter(p, game.training.state),
    drawMeter = meter ? runeMeter(u, meter, 1584 + dr, 866) : undefined;
  const flow = meter
      ? undefined
      : u.text("", 1618 + dr, 897, 27, colours.water, 180),
    tip = meter
      ? undefined
      : u.text(
          feedbackData.flowTip.idle,
          1618 + dr,
          943,
          24,
          colours.muted,
          180,
        );
  const clock = frameGraphics();
  u.content.addChild(clock);
  const artClock = u.kit.source !== "procedural";
  const clockFace = artClock ? u.kit.sprite("clock.face") : undefined,
    clockRim = artClock ? u.kit.sprite("clock.rim") : undefined,
    clockHand = artClock ? u.kit.sprite("clock.hand") : undefined;
  for (const part of [clockFace, clockRim, clockHand])
    if (part) {
      part.anchor.set(0.5);
      part.position.set(993, 109);
      part.width = 96;
      part.height = 96;
      u.content.addChild(part);
    }
  const clockPips = Array.from({ length: 4 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    const pair = [
      artClock ? u.kit.sprite("clock.pip.off") : undefined,
      artClock ? u.kit.sprite("clock.pip.on") : undefined,
    ];
    for (const part of pair)
      if (part) {
        part.anchor.set(0.5);
        part.position.set(993 + Math.cos(a) * 43, 109 + Math.sin(a) * 43);
        part.width = 16;
        part.height = 16;
        u.content.addChild(part);
      }
    return pair;
  });
  clock.visible = !artClock;
  sigil(u, "inscription.collar", 993, 109, 122, 0.8);
  const rune = u.text("", 1064, 64, 34, colours.gold, 400, true),
    next = u.text("", 1064, 109, 26, colours.muted, 420);
  const feedback = u.text(
    "",
    650,
    game.lab ? 390 : 220,
    32,
    colours.water,
    1000,
    true,
  );
  const hint = u.text(
    "WASD move  /  Shift sprint  /  Space roll      LMB cast  /  RMB absorb  /  1-4 spells",
    524,
    824,
    24,
    colours.text,
    1000,
  );
  const castBar = u.progress("cast", 524, 785, 1020, 22);
  const castLabel = u.text("", 524, 750, 24, colours.water, 1020);
  return () => {
    if (u.screen !== "arena") return;
    const { state, player } = game.training;
    hp(player.hp);
    mana(player.mana);
    stamina(player.stamina);
    const pending = player.pending;
    castBar(
      pending
        ? (state.tick - pending.startTick) /
            Math.max(1, pending.releaseTick - pending.startTick)
        : null,
    );
    castLabel.text = pending
      ? pending.kind === "staff"
        ? "Staff strike"
        : state.tick <
            pending.startTick +
              Math.ceil(
                (pending.releaseTick - pending.startTick) *
                  tuningFor(state).castCommitFraction,
              )
          ? "Shaping / roll cancels"
          : "Committed / releasing"
      : "";
    heading.text =
      game.mode === "tiro"
        ? `${state.actors.filter((a) => a.team !== player.team && !a.tags.includes("DEFEATED")).length} opponents remain`
        : game.lab
          ? `${game.lab.config.playerSchool.toUpperCase()} / practice mage`
          : heroName[hudSchool(player)];
    const ranked = showsRanks(player),
      agility = agilityRank(player, state),
      ultimates: string[] = [];
    for (let i = 0; i < count; i++) {
      const s = slotView(player, i, state)!;
      const slot = u.buttons.find((b) => b.id === `slot-${i}`)!;
      slot.selected = game.input.slot === i;
      slot.tooltip = s.tooltip;
      labels[i]!.text = s.name;
      labels[i]!.style.fill = s.dark ? colours.muted : colours.text;
      const remaining = s.remainingS;
      slot.state = remaining > 0 ? "cooldown" : undefined;
      cooldownBars[i]!(
        remaining > 0 ? 1 - Math.min(1, remaining / s.cooldownS) : null,
      );
      detail[i]!.text =
        remaining > 0
          ? `${remaining.toFixed(1)}s recovering`
          : s.passive
            ? "Perfect counter"
            : s.price;
      detail[i]!.style.fill = s.crest
        ? hexColour(feedbackData.slotPrice.crestFill)
        : colours.muted;
      repeats[i]!.visible = s.repeat && remaining <= 0;
      const { x, w } = slots[i]!;
      slotFrames[i]!.clear();
      if (game.input.slot === i && u.kit.source === "procedural")
        slotFrames[i]!.rect(x + 5, 879, w - 10, 142).stroke({
          color: colours.water,
          width: 3,
        });
      if (s.crest)
        slotFrames[i]!.rect(x + 2, 856, w - 4, 168).stroke({
          color: hexColour(feedbackData.slotPrice.crestFill),
          width: 3,
        });
      masks[i]!.clear();
      if (remaining > 0)
        masks[i]!.moveTo(x + 42, 915)
          .arc(
            x + 42,
            915,
            29,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / s.cooldownS),
          )
          .lineTo(x + 42, 915)
          .fill({ color: 0x030a13, alpha: 0.7 });
      // Build readout: the spell's rank as pips; the last pip becomes a star when the rank-5 ultimate is carried.
      pips[i]!.clear();
      if (ranked)
        for (let k = 0; k < maxSpellRank; k++) {
          const px = x + 82 + k * 16,
            py = 939,
            lit = k < s.rank;
          if (k === maxSpellRank - 1 && s.ultimate)
            pips[i]!.star(px, py, 5, 8, 3.5).fill(colours.gold);
          else
            pips[i]!.poly([px, py - 5, px + 5, py, px, py + 5, px - 5, py])
              .fill(lit ? colours.gold : colours.panel)
              .stroke({ color: colours.gold, width: 1 });
        }
      if (s.ultimate) ultimates.push(s.ultimate);
    }
    build.text =
      ranked || agility > 1
        ? [
            `BUILD  ${buildName(player)}`,
            agility > 1 ? `Agility ${agility}` : "",
            ultimates.length ? `Ultimate: ${ultimates.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("  /  ")
        : "";
    if (drawMeter) {
      const view = resourceMeter(player, state);
      if (view) drawMeter(view);
    }
    if (flow && tip) {
      flow.text = flowLine(player);
      const nowS = performance.now() / 1000,
        mark = flowMark(player.water);
      if (game.flowSeen?.player === player)
        game.flowTip = nextFlowTip(
          game.flowTip,
          game.flowSeen.mark,
          mark,
          nowS,
        );
      game.flowSeen = { player, mark };
      tip.text = flowTipText(game.flowTip, player.water.flow, nowS);
    }
    const { tier, untilS: until, progress } = collarClock(state, player);
    rune.text = `COLLAR  ${runes[tier]}`;
    next.text =
      tier < 4 ? `Next rune in ${until.toFixed(1)}s` : "All four runes awake";
    clock
      .clear()
      .circle(993, 109, 43)
      .stroke({ color: colours.edge, width: 3 })
      .circle(993, 109, 36)
      .stroke({ color: colours.gold, width: 1 });
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 2;
      clock
        .poly([
          993 + Math.cos(a) * 43,
          109 + Math.sin(a) * 43 - 5,
          998 + Math.cos(a) * 43,
          109 + Math.sin(a) * 43,
          993 + Math.cos(a) * 43,
          114 + Math.sin(a) * 43,
          988 + Math.cos(a) * 43,
          109 + Math.sin(a) * 43,
        ])
        .fill(i < tier ? colours.water : colours.edge);
    }
    const a = -Math.PI / 2 + Math.PI * 2 * progress;
    if (clockHand) clockHand.rotation = a + Math.PI / 2;
    clockPips.forEach(([off, on], i) => {
      if (off) off.visible = i >= tier;
      if (on) on.visible = i < tier;
    });
    clock
      .moveTo(993, 109)
      .lineTo(993 + Math.cos(a) * 27, 109 + Math.sin(a) * 27)
      .stroke({ color: colours.water, width: 3 });
    feedback.text =
      seconds(state.tick - game.lastPerfect) <
      Math.max(
        runtime.presentation.perfectFlashS,
        feedbackData.perfectGain.holdS,
      )
        ? (game.lastGain?.text ?? "PERFECT ABSORB")
        : player.absorb
          ? "WARD RAISED"
          : "";
    hint.text =
      u.modality === "gamepad"
        ? "Left stick move  /  Right stick aim  /  RT cast  /  LT absorb  /  A roll  /  LB RB spells"
        : "WASD move  /  Shift sprint  /  Space roll      LMB cast  /  RMB absorb  /  1-4 spells";
  };
}
