import { describe, expect, it } from "vitest";

import { verifyValue } from "../src/content/validator";

describe("verifyValue", () => {
  it("returns true when the filled value only differs in casing or whitespace", () => {
    const input = document.createElement("input");
    input.value = "  Nguyễn   Văn A  ";

    expect(verifyValue(input, "nguyễn văn a")).toBe(true);
  });

  it("returns false when the retained value differs from the expected value", () => {
    const input = document.createElement("input");
    input.value = "nguyen.van.a@example.com";

    expect(verifyValue(input, "nguyen.van.b@example.com")).toBe(false);
  });
});
