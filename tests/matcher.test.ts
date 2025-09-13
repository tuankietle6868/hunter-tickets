import { describe, expect, it } from "vitest";

import { type AliasEntry } from "../src/shared/aliasDictionary";
import { bestAliasMatch, scoreField } from "../src/shared/matcher";

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

describe("scoreField", () => {
  it("combines label, placeholder, and autocomplete into a capped confidence score", () => {
    expect(
      scoreField({
        labelText: "Số điện thoại",
        placeholder: "Nhập số điện thoại",
        autocomplete: "tel",
      }),
    ).toMatchObject({ type: "PHONE", confidence: 100, ambiguous: false });
  });

  it("marks both close candidates ambiguous when Tên conflicts with Tên công ty", () => {
    const result = scoreField({
      visibleQuestionText: "Tên",
      labelText: "Tên công ty",
    });

    expect(result).toMatchObject({
      type: "COMPANY_NAME",
      runnerUpType: "FULL_NAME",
      ambiguous: true,
    });
    expect(result.candidateGap).toBeLessThan(15);
    expect(result.ambiguousTypes).toEqual(["COMPANY_NAME", "FULL_NAME"]);
  });
});
