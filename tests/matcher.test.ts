import { describe, expect, it } from "vitest";

import { type AliasEntry } from "../src/shared/aliasDictionary";
import { bestAliasMatch } from "../src/shared/matcher";

describe("bestAliasMatch", () => {
  it("returns the weight of an exact alias", () => {
    expect(bestAliasMatch("FULL_NAME", "ho va ten")).toBe(100);
  });

  it("returns the highest weight when multiple contains aliases match", () => {
    expect(bestAliasMatch("PHONE", "phone number lien he")).toBe(95);
  });

  it("prefers an exact alias weight over a lower-weight contains alias", () => {
    expect(bestAliasMatch("PHONE", "so dien thoai")).toBe(100);
  });

  it("supports regex aliases", () => {
    const aliases: AliasEntry[] = [
      { pattern: "sdt", weight: 70, matchType: "contains" },
      { pattern: "^sdt\\s*\\(zalo\\)$", weight: 95, matchType: "regex" },
    ];

    expect(bestAliasMatch("PHONE", "sdt (zalo)", aliases)).toBe(95);
  });

  it("returns undefined when no alias matches", () => {
    expect(bestAliasMatch("EMAIL", "tai khoan thanh toan")).toBeUndefined();
  });
});
