/**
 * Pad families for control copy. The Gamepad.id string tells a Sony pad from a Microsoft one; any other pad on the
 * standard mapping is Xbox-shaped, so "generic" uses the Xbox names. Pure: no DOM, no storage.
 */
export type PadFamily = "xbox" | "playstation" | "generic";

/** The family a Gamepad.id string names. */
export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  // Xbox first: "Xbox Wireless Controller" also contains the Sony-style "wireless controller".
  if (/045e|xbox|xinput/.test(s)) return "xbox";
  if (/054c|dualshock|dualsense|wireless controller/.test(s))
    return "playstation";
  return "generic";
}

/** The button names one family's copy uses. `menu` is the pause button; `confirm` and `back` are the menu pair. */
export interface PadNames {
  confirm: string;
  back: string;
  rt: string;
  lt: string;
  lb: string;
  rb: string;
  menu: string;
}
const xbox: PadNames = {
  confirm: "A",
  back: "B",
  rt: "RT",
  lt: "LT",
  lb: "LB",
  rb: "RB",
  menu: "Start",
};
const playstation: PadNames = {
  confirm: "Cross",
  back: "Circle",
  rt: "R2",
  lt: "L2",
  lb: "L1",
  rb: "R1",
  menu: "Options",
};
export const padNames = (family: PadFamily): PadNames =>
  family === "playstation" ? playstation : xbox;
