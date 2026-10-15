/* Mage Arena TV shell: the phone controller as a standard Gamepad. Injected at the top of <head>, before any game script.
 * navigator.getGamepads() gains a synthetic `mapping: "standard"` pad while a phone is seated. A real gamepad keeps
 * working: when one is connected the phone's state is merged into it (sticks by larger deflection, buttons OR'ed), so
 * the game, which reads the first standard pad, sees both. State is "q,bits,lx,ly,rx,ry" from the shell: pulled from
 * the MageArenaPad bridge on every getGamepads call while a phone is seated (feed "pull", measured smoother), or pushed
 * by the shell through __mPad.set on every phone frame ("push"). Seat changes are always pushed. */
(function () {
  if (window.__mPad) return;
  var bridge = window.MageArenaPad, nav = navigator;
  var native = typeof nav.getGamepads === "function" ? nav.getGamepads.bind(nav) : function () { return []; };
  var feed = bridge ? String(bridge.feed()) : "push";
  var buttons = [];
  for (var i = 0; i < 17; i++) buttons.push({ pressed: false, touched: false, value: 0 });
  var pad = {
    id: "Mage Arena phone controller (STANDARD GAMEPAD)", index: 0, connected: false, mapping: "standard",
    timestamp: 0, axes: [0, 0, 0, 0], buttons: buttons, vibrationActuator: null, hapticActuators: []
  };
  var line = "", applied = "", q = -1, reported = -1, reads = 0, merged = 0, events = 0;

  function apply(next) {
    if (next === applied) return;
    applied = next;
    var was = pad.connected;
    if (!next) {
      pad.connected = false;
      for (var i = 0; i < 17; i++) { buttons[i].pressed = buttons[i].touched = false; buttons[i].value = 0; }
      pad.axes = [0, 0, 0, 0];
    } else {
      var p = next.split(","), bits = +p[1];
      q = +p[0];
      pad.connected = true;
      pad.axes = [+p[2] || 0, +p[3] || 0, +p[4] || 0, +p[5] || 0];
      for (var j = 0; j < 17; j++) {
        var on = (bits >> j & 1) === 1;
        buttons[j].pressed = buttons[j].touched = on;
        buttons[j].value = on ? 1 : 0;
      }
    }
    pad.timestamp = performance.now();
    if (was !== pad.connected) fire(pad.connected ? "gamepadconnected" : "gamepaddisconnected");
  }
  function fire(type) {
    events++;
    var e = new Event(type);
    Object.defineProperty(e, "gamepad", { value: pad });
    setTimeout(function () { window.dispatchEvent(e); }, 0);
  }
  function deflection(a, i) { return Math.hypot(a[i] || 0, a[i + 1] || 0); }
  function merge(real) {
    merged++;
    var axes = Array.prototype.slice.call(real.axes);
    for (var s = 0; s < 4; s += 2)
      if (deflection(pad.axes, s) > deflection(axes, s)) { axes[s] = pad.axes[s]; axes[s + 1] = pad.axes[s + 1]; }
    var out = [];
    for (var i = 0; i < Math.max(real.buttons.length, 17); i++) {
      var r = real.buttons[i], m = buttons[i], on = !!(r && r.pressed) || !!(m && m.pressed);
      out.push({ pressed: on, touched: on || !!(r && r.touched), value: Math.max(r ? r.value : 0, m ? m.value : 0) });
    }
    return { id: real.id, index: real.index, connected: true, mapping: "standard", timestamp: Math.max(real.timestamp, pad.timestamp),
      axes: axes, buttons: out, vibrationActuator: real.vibrationActuator || null, hapticActuators: [] };
  }
  function getGamepads() {
    reads++;
    // A bridge call costs about 0.5 ms on the Stick, so the pull feed only reads while the shell says a phone is seated.
    if (feed === "pull" && line) apply(String(bridge.pad()));
    else apply(line);
    var list = Array.prototype.slice.call(native() || []);
    if (!pad.connected) return list;
    // Push feed: tell the shell which frame the game just read (it acks it to the phone; a new phone restarts q at 0).
    if (feed !== "pull" && q !== reported && bridge) { reported = q; bridge.consumed(q); }
    for (var i = 0; i < list.length; i++)
      if (list[i] && list[i].connected && list[i].mapping === "standard") { list[i] = merge(list[i]); return list; }
    var slot = list.indexOf(null);
    if (slot < 0) slot = list.length;
    pad.index = slot;
    list[slot] = pad;
    return list;
  }
  Object.defineProperty(nav, "getGamepads", { value: getGamepads, configurable: true, writable: true });
  if (bridge) { line = String(bridge.pad()); apply(line); } // a reload while a phone is already seated
  window.__mPad = {
    set: function (next) { line = next; apply(next); },
    stats: function () { return { feed: feed, connected: pad.connected, q: q, reads: reads, merged: merged, events: events }; }
  };
})();
