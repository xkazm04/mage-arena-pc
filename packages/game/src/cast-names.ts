const titles = new Set(["Elder", "Old", "Warden", "Lanista"]);

/** The name the camp calls someone by: "Elder Sadruba" -> "Sadruba", "Brennic the Red" -> "Brennic". */
export function shortName(name: string) {
  const words = name.split(" ");
  return words.find((w) => !titles.has(w)) ?? name;
}

/** Whether a line of camp text is about this person, by full or short name. */
export function mentions(text: string, name: string) {
  return [name, shortName(name)].some((n) =>
    new RegExp(`\\b${n}\\b`).test(text),
  );
}
