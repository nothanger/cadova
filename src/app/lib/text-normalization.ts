const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["\\u00e2\\u20ac\\u2122", "’"],
  ["\\u00e2\\u20ac\\u02dc", "‘"],
  ["\\u00e2\\u20ac\\u0153", "“"],
  ["\\u00e2\\u20ac\\u009d", "”"],
  ["\\u00e2\\u20ac\\u015c", "“"],
  ["\\u00e2\\u20ac\\u201d", "—"],
  ["\\u00e2\\u20ac\\u201c", "–"],
  ["\\u00e2\\u20ac\\u00a6", "…"],
  ["\\u00e2\\u20ac\\u00a2", "•"],
  ["\\u00c3\\u20ac", "À"],
  ["\\u00c3\\u201a", "\u00c2"],
  ["\\u00c3\\u2021", "Ç"],
  ["\\u00c3\\u2030", "É"],
  ["\\u00c3\\u02c6", "È"],
  ["\\u00c3\\u0160", "Ê"],
  ["\\u00c3\\u2039", "Ë"],
  ["\\u00c3\\u201d", "Ô"],
  ["\\u00c3\\u0152", "Ü"],
  ["\\u00c3\\u0020", "à"],
  ["\\u00c3\\u00a1", "á"],
  ["\\u00c3\\u00a2", "â"],
  ["\\u00c3\\u00a4", "ä"],
  ["\\u00c3\\u00a7", "ç"],
  ["\\u00c3\\u00a8", "è"],
  ["\\u00c3\\u00a9", "é"],
  ["\\u00c3\\u00aa", "ê"],
  ["\\u00c3\\u00ab", "ë"],
  ["\\u00c3\\u00ae", "î"],
  ["\\u00c3\\u00af", "ï"],
  ["\\u00c3\\u00b4", "ô"],
  ["\\u00c3\\u00b6", "ö"],
  ["\\u00c3\\u00b9", "ù"],
  ["\\u00c3\\u00bb", "û"],
  ["\\u00c3\\u00bc", "ü"],
  ["\\u00c3\\u00b1", "ñ"],
  ["\\u00c2\\u00b0", "°"],
  ["\\u00c2\\u00b7", "·"],
  ["\\u00c2\\u0020", " "],
  ["\\u00c2", ""],
];

export function fixMojibakeText(value: string) {
  return MOJIBAKE_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(new RegExp(pattern, "g"), replacement),
    value,
  );
}

export function fixMojibakeTextArray(values: string[]) {
  return values.map((value) => fixMojibakeText(value));
}

const SKIP_TEXT_KEYS = new Set([
  "id",
  "userId",
  "email",
  "url",
  "link",
  "href",
  "src",
  "slug",
  "key",
]);

export function fixMojibakeDisplayPayload<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    return (SKIP_TEXT_KEYS.has(key) ? value : fixMojibakeText(value)) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => fixMojibakeDisplayPayload(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        fixMojibakeDisplayPayload(entryValue, entryKey),
      ]),
    ) as T;
  }

  return value;
}
