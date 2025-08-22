import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("runs with jsdom", () => {
    expect(document.createElement("div").nodeName).toBe("DIV");
  });
});
