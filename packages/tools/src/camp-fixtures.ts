import {
  actCamp,
  beginListening,
  campView,
  createCampSession,
  decision,
  listeningScene,
  moveCamp,
  passSlot,
  settleCamp,
  stepListening,
  campPlay,
} from "@mage/core";
import { hash, loadTables, plan } from "@mage/director";
export function campMornings() {
  const t = loadTables();
  let s = createCampSession(t, 73);
  const mornings = [];
  for (let day = 1; day <= 3; day++) {
    if (day === 1) {
      s = moveCamp(t, s, "commons");
      s = actCamp(
        t,
        s,
        decision(t, s.camp, s.camp.player, "PROTECT", { target: "fenna" }),
      );
      s = actCamp(
        t,
        s,
        decision(t, s.camp, s.camp.player, "BEFRIEND", { target: "fenna" }),
      );
      s = moveCamp(t, s, "tent");
      s = beginListening(s);
      for (let tick = 0; tick < campPlay.listening.durationTicks; tick++) {
        const n = listeningScene(s.listening!);
        s = stepListening(s, {
          lane: n.beacon,
          listening: n.beacon !== n.patrol || n.warning,
        });
      }
    } else {
      s = moveCamp(t, s, day === 2 ? "exchange" : "yard");
      s = actCamp(
        t,
        s,
        decision(
          t,
          s.camp,
          s.camp.player,
          day === 2 ? "WORK" : "TRAIN",
          day === 2 ? {} : { stat: "vigor" },
        ),
      );
      s = passSlot(passSlot(s));
    }
    const beforeHash = hash(s.camp);
    s = settleCamp(t, s, [], (id) => plan(t, s.camp, id, true));
    const view = campView(t, s);
    mornings.push({
      label: "simulated",
      day: s.camp.day,
      beforeHash,
      afterHash: hash(s.camp),
      player: view.player,
      board: view.board,
      journal: view.journal,
      trace: s.lastResolution!.trace,
      rolls: s.lastResolution!.rolls,
    });
  }
  return mornings;
}
