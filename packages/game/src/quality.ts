import data from "../data/quality.json" with { type: "json" };

export type QualityName = keyof typeof data.profiles;
export type Quality = (typeof data.profiles)[QualityName] & {
  name: QualityName;
};
/** `?quality=tv|desktop` wins; otherwise a Fire TV user agent selects the TV profile. `?q.<key>=<value>` overrides one knob (profiling). */
export function pickQuality(
  search = globalThis.location?.search ?? "",
  userAgent = globalThis.navigator?.userAgent ?? "",
): Quality {
  const params = new URLSearchParams(search),
    asked = params.get("quality");
  const name: QualityName =
    asked && asked in data.profiles
      ? (asked as QualityName)
      : userAgent.includes(data.tvUserAgent)
        ? "tv"
        : "desktop";
  const q: Record<string, unknown> = { ...data.profiles[name], name };
  for (const [key, value] of params)
    if (key.startsWith("q.") && key.slice(2) in q) {
      const k = key.slice(2),
        was = q[k];
      q[k] =
        typeof was === "number"
          ? Number(value)
          : typeof was === "boolean"
            ? value === "1" || value === "true"
            : value;
    }
  return q as Quality;
}
export const quality = pickQuality();
