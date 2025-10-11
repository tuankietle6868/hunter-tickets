import { describe, expect, it } from "vitest";

import { createStableElementLocator, resolveLiveElement } from "../src/content/liveElement";

describe("live element locator", () => {
  it("resolves a Google Forms-like replacement input by aria-labelledby", () => {
    document.body.innerHTML = `
      <div id="question-title">Địa chỉ</div>
      <textarea aria-labelledby="question-title"></textarea>
    `;
    const original = document.querySelector("textarea")!;
    const locator = createStableElementLocator(original);
    const replacement = document.createElement("textarea");
    replacement.setAttribute("aria-labelledby", "question-title");
    original.replaceWith(replacement);

    expect(resolveLiveElement(locator)).toBe(replacement);
  });
});
