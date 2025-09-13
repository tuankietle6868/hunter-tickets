/** Returns true only for controls that are genuinely invisible to the user. */
export function isCssHidden(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (!style) continue;
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.opacity === "0"
    ) {
      return true;
    }
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  // JSDOM has no layout and reports a zero rect for every element. Requiring
  // explicit zero CSS dimensions keeps this check meaningful in browsers while
  // allowing DOM-only tests to exercise normal, visible controls.
  return (
    rect.width === 0 &&
    rect.height === 0 &&
    style?.width === "0px" &&
    style.height === "0px"
  );
}

/** A normally-sized visible field outside the current viewport is not hidden. */
export function isOffscreen(element: HTMLElement): boolean {
  if (isCssHidden(element)) return false;

  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > view.innerHeight ||
    rect.left > view.innerWidth
  );
}

/** Brings a valid offscreen field into view immediately before verification. */
export function scrollIntoViewIfOffscreen(element: HTMLElement): void {
  if (isOffscreen(element)) {
    element.scrollIntoView?.({ behavior: "auto", block: "center" });
  }
}
