import { describe, expect, it } from "vitest";

import { formatValueForInput } from "../src/content/dateValue";

describe("Vietnamese phone formatting", () => {
  it("converts a +84 profile number to the 10-digit domestic format when maxlength requires it", () => {
    const input = document.createElement("input");
    input.type = "tel";
    input.maxLength = 10;

    expect(formatValueForInput("+84 901 234 567", "PHONE", input)).toBe("0901234567");
  });

  it("converts a domestic profile number to +84 format when maxlength requires it", () => {
    const input = document.createElement("input");
    input.type = "tel";
    input.maxLength = 12;

    expect(formatValueForInput("0901234567", "PHONE", input)).toBe("+84901234567");
  });
});
