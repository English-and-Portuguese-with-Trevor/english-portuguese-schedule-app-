import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatDate } from "@/i18n/format";
import { STRINGS } from "@/i18n/strings";
import { translate } from "@/i18n/translate";
import { SITE_LANGUAGES } from "@/lib/prefs";

const OTHER_LANGUAGES = SITE_LANGUAGES.map((l) => l.code).filter(
  (c) => c !== "en",
) as ("es" | "pt" | "fr")[];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Every literal passed to t("...") or tr("..."). */
function keysUsedInSource(): string[] {
  const keys = new Set<string>(["{day} at {time}"]);
  for (const file of sourceFiles(join(process.cwd(), "src"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(
      /\btr?\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g,
    )) {
      keys.add((m[1] ?? m[2]).replace(/\\(.)/g, "$1"));
    }
  }
  return [...keys];
}

describe("translate", () => {
  it("fills in placeholders and falls back to English", () => {
    expect(translate("pt", "Hi, {name}", { name: "Ana" })).toBe("Olá, Ana");
    expect(translate("en", "Hi, {name}", { name: "Ana" })).toBe("Hi, Ana");
    expect(translate("fr", "Something new")).toBe("Something new");
  });
});

describe("dates", () => {
  const date = new Date("2026-10-03T15:30:00Z"); // Saturday; tests run in UTC

  it("keeps the English wording", () => {
    expect(formatDate(date, "dayAtTime", "en")).toBe("Sat, Oct 3 at 3:30 PM");
  });

  it("uses each language's own wording and clock", () => {
    expect(formatDate(date, "longDay", "pt")).toBe("sábado, 3 de outubro");
    expect(formatDate(date, "dayAtTime", "pt")).toBe(
      "sáb., 3 de out. às 15:30",
    );
    expect(formatDate(date, "time", "fr")).toBe("15:30");
  });
});

describe("translation coverage", () => {
  const keys = keysUsedInSource();

  it("finds the site text", () => {
    expect(keys.length).toBeGreaterThan(80);
  });

  it.each(OTHER_LANGUAGES)(
    "has a %s translation for every piece of text",
    (language) => {
      const table = STRINGS[language] as Record<string, string>;
      expect(keys.filter((k) => !table[k])).toEqual([]);
    },
  );

  it.each(OTHER_LANGUAGES)("keeps the same placeholders in %s", (language) => {
    const table = STRINGS[language] as Record<string, string>;
    const placeholders = (s: string) =>
      (s.match(/\{\w+\}/g) || []).sort().join();
    for (const key of keys)
      expect(placeholders(table[key]), key).toBe(placeholders(key));
  });
});
