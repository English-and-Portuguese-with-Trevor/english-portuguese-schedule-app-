import { describe, expect, it } from "vitest";
import {
  acceptLanguages,
  learningToLessonLanguage,
  parsePrefs,
  siteLanguage,
  writePrefs,
} from "@/lib/prefs";

function fakeDocument() {
  let jar = "";
  return {
    lastSet: "",
    get cookie() {
      return jar;
    },
    set cookie(value: string) {
      this.lastSet = value;
      jar = value.split(";")[0];
    },
  };
}

const live = {
  hostname: "lessons.englishandportuguesewithtrevor.com",
  protocol: "https:",
};

describe("shared preferences cookie", () => {
  it("is saved on the parent domain for a year, so every site sees it and it survives logging out", () => {
    const doc = fakeDocument();
    writePrefs({ theme: "dark" }, doc, live);
    expect(doc.lastSet).toContain("Domain=englishandportuguesewithtrevor.com");
    expect(doc.lastSet).toContain("Max-Age=31536000");
    expect(doc.lastSet).toContain("Secure");
    expect(parsePrefs(doc.cookie)).toEqual({ theme: "dark" });
  });

  it("merges changes and can remove a value", () => {
    const doc = fakeDocument();
    writePrefs({ theme: "dark", learning: "English" }, doc, live);
    writePrefs({ translation: "Spanish" }, doc, live);
    expect(parsePrefs(doc.cookie)).toEqual({
      theme: "dark",
      learning: "English",
      translation: "Spanish",
    });
    writePrefs({ translation: null }, doc, live);
    expect(parsePrefs(doc.cookie)).toEqual({
      theme: "dark",
      learning: "English",
    });
  });

  it("ignores anything unexpected", () => {
    expect(parsePrefs("ept-prefs=not-json")).toEqual({});
    expect(
      parsePrefs(
        `ept-prefs=${encodeURIComponent('{"theme":"<script>","learning":"Klingon","x":1}')}`,
      ),
    ).toEqual({});
    expect(
      parsePrefs(
        "other=1; ept-prefs=" + encodeURIComponent('{"theme":"dark"}'),
      ),
    ).toEqual({ theme: "dark" });
  });

  it("stays on the current host when running locally", () => {
    const doc = fakeDocument();
    writePrefs({ theme: "light" }, doc, {
      hostname: "localhost",
      protocol: "http:",
    });
    expect(doc.lastSet).not.toContain("Domain=");
    expect(doc.lastSet).not.toContain("Secure");
  });
});

describe("learningToLessonLanguage", () => {
  it("maps the learning language to the booking form's value", () => {
    expect(learningToLessonLanguage("English")).toBe("ENGLISH");
    expect(learningToLessonLanguage("Portuguese")).toBe("PORTUGUESE");
    expect(learningToLessonLanguage(null)).toBeUndefined();
  });
});

describe("siteLanguage", () => {
  it("uses the saved choice, then the browser's languages, then English", () => {
    expect(siteLanguage({ site: "fr" }, ["es"])).toBe("fr");
    expect(siteLanguage({}, ["de-DE", "pt-BR"])).toBe("pt");
    expect(siteLanguage({}, ["de"])).toBe("en");
  });

  it("reads the Accept-Language header in order of preference", () => {
    expect(acceptLanguages("de;q=0.9, es-MX;q=0.95, en;q=0.1")).toEqual([
      "es-MX",
      "de",
      "en",
    ]);
    expect(siteLanguage({}, acceptLanguages("fr-CA,fr;q=0.9"))).toBe("fr");
    expect(acceptLanguages(null)).toEqual([]);
  });
});
