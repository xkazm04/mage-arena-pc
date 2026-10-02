import {
  createCampSession,
  createState,
  moveCamp,
  parleyRules,
  seedParleyFacts,
  type CampSession,
  type Tables,
} from "@mage/core";
/** Synthetic held-Knowing state for boundary tests; the browser gate earns it in play. */
export function knowingFixture(t: Tables, seed = 73) {
  const s = seedParleyFacts(
    createCampSession(t, seed, createState(t, seed, 2)),
  );
  s.camp.characters[s.camp.player].knowledge.push("K-nysa-bread");
  return moveCamp(t, s, "commons");
}
export function parleyBounds(
  before: CampSession,
  after: CampSession,
  target = "nysa",
): string[] {
  const errors: string[] = [],
    a = before.camp,
    b = after.camp;
  const equal = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right);
  for (const key of Object.keys(a) as (keyof typeof a)[]) {
    if (!["characters", "trust"].includes(key) && !equal(a[key], b[key]))
      errors.push(`unauthorized:${key}`);
  }
  for (const [id, character] of Object.entries(a.characters)) {
    for (const key of Object.keys(character) as (keyof typeof character)[]) {
      if (id === a.player && key === "knowledge") continue;
      if (!equal(character[key], b.characters[id][key]))
        errors.push(`unauthorized:${id}/${key}`);
    }
  }
  for (const [key, value] of Object.entries(a.trust)) {
    if (key === `${target}>${a.player}`) {
      if (Math.abs(b.trust[key] - value) > parleyRules.trustLarge)
        errors.push("trust-limit");
    } else if (b.trust[key] !== value) errors.push(`unauthorized:trust/${key}`);
  }
  for (const id of b.characters[a.player].knowledge.filter(
    (id) => !a.characters[a.player].knowledge.includes(id),
  )) {
    if (
      !a.characters[target].knowledge.includes(id) ||
      !a.facts.some((f) => f.id === id && f.truth !== false)
    )
      errors.push(`invented-fact:${id}`);
  }
  if (after.intentPromises.some((p) => p.target !== target))
    errors.push("foreign-intent-override");
  return errors;
}
