import { describe, expect, it } from "vitest";

import {
  ALIAS_DICTIONARY,
  hasNegativeMatch,
  NEGATIVE_PATTERNS,
} from "../src/shared/aliasDictionary";
import type { FieldType } from "../src/shared/types";

function patternsFor(fieldType: FieldType): string[] {
  return ALIAS_DICTIONARY[fieldType].map(({ pattern }) => pattern);
}

describe("ALIAS_DICTIONARY", () => {
  it("contains every alias specified in the project documentation", () => {
    expect(patternsFor("FULL_NAME")).toEqual(
      expect.arrayContaining(["ho va ten", "ho ten", "full name", "name"]),
    );
    expect(patternsFor("PHONE")).toEqual(
      expect.arrayContaining(["so dien thoai", "dien thoai", "sdt", "phone", "mobile"]),
    );
    expect(patternsFor("ID_NUMBER")).toEqual(
      expect.arrayContaining(["cccd", "can cuoc cong dan", "cmnd", "id number", "citizen id"]),
    );
    expect(patternsFor("EMAIL")).toEqual(expect.arrayContaining(["email", "e-mail"]));
    expect(patternsFor("DATE_OF_BIRTH")).toEqual(
      expect.arrayContaining(["ngay sinh", "date of birth", "dob"]),
    );
    expect(patternsFor("ADDRESS")).toEqual(expect.arrayContaining(["dia chi", "address"]));
  });

  it("includes common abbreviated and alternate labels", () => {
    expect(patternsFor("FULL_NAME")).toEqual(expect.arrayContaining(["hoten", "fullname"]));
    expect(patternsFor("PHONE")).toEqual(expect.arrayContaining(["dt", "tel"]));
    expect(patternsFor("ID_NUMBER")).toEqual(expect.arrayContaining(["so cccd", "so cmnd"]));
    expect(patternsFor("EMAIL")).toContain("thu dien tu");
    expect(patternsFor("DATE_OF_BIRTH")).toEqual(
      expect.arrayContaining(["ngay thang nam sinh", "birth date"]),
    );
    expect(patternsFor("ADDRESS")).toEqual(expect.arrayContaining(["dia chi lien he", "noi o"]));
  });

  it("has a non-empty alias list for each supported field type", () => {
    const supportedTypes: FieldType[] = [
      "FULL_NAME",
      "PHONE",
      "ID_NUMBER",
      "EMAIL",
      "DATE_OF_BIRTH",
      "ADDRESS",
    ];

    for (const fieldType of supportedTypes) {
      expect(ALIAS_DICTIONARY[fieldType]).not.toHaveLength(0);
    }
  });
});

describe("NEGATIVE_PATTERNS", () => {
  it("blocks 'Tên công ty' from matching FULL_NAME", () => {
    expect(hasNegativeMatch("FULL_NAME", "Tên công ty")).toBe(true);
  });

  it("includes every documented FULL_NAME exclusion", () => {
    expect(NEGATIVE_PATTERNS.FULL_NAME).toEqual(
      expect.arrayContaining([
        "ten cong ty",
        "ten dang nhap",
        "ten nguoi nhan",
        "company name",
        "username",
      ]),
    );
  });
});
