import { afterEach, describe, expect, it, vi } from "vitest";

import { isCssHidden, isOffscreen, scrollIntoViewIfOffscreen } from "../src/content/visibility";

function setRect(element: HTMLElement, rect: Partial<DOMRect>): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        top: 0,
        right: 120,
        bottom: 24,
        left: 0,
        width: 120,
        height: 24,
        x: 0,
        y: 0,
        toJSON: () => ({}),
        ...rect,
      }) as DOMRect,
  });
}

describe("field visibility", () => {
  afterEach(() => document.body.replaceChildren());

  it.each([
    ["display:none", (element: HTMLElement) => (element.style.display = "none")],
    ["visibility:hidden", (element: HTMLElement) => (element.style.visibility = "hidden")],
    ["opacity:0", (element: HTMLElement) => (element.style.opacity = "0")],
    ["zero dimensions", (element: HTMLElement) => {
      element.style.width = "0px";
      element.style.height = "0px";
      setRect(element, { width: 0, height: 0, right: 0, bottom: 0 });
    }],
  ])("treats %s as CSS-hidden", (_name, applyHiddenStyle) => {
    const input = document.createElement("input");
    applyHiddenStyle(input);
    document.body.append(input);

    expect(isCssHidden(input)).toBe(true);
    expect(isOffscreen(input)).toBe(false);
  });

  it("keeps a normally-sized field below the viewport valid and scrolls it before verify", () => {
    const input = document.createElement("input");
    const scrollIntoView = vi.fn();
    input.scrollIntoView = scrollIntoView;
    setRect(input, { top: window.innerHeight + 200, bottom: window.innerHeight + 224 });
    document.body.append(input);

    expect(isCssHidden(input)).toBe(false);
    expect(isOffscreen(input)).toBe(true);
    scrollIntoViewIfOffscreen(input);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });
});
