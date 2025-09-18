import type { StableElementLocator } from "../shared/types";

/** Captures only selectors that survive React/Vue replacement of a DOM node. */
export function createStableElementLocator(element: HTMLElement): StableElementLocator | undefined {
  const id = element.id || undefined;
  const name = element.getAttribute("name")?.trim() || undefined;
  return id || name ? { id, name, tagName: element.tagName.toLowerCase() } : undefined;
}

/** Resolves the current connected node rather than retaining a stale element reference. */
export function resolveLiveElement(
  locator: StableElementLocator | undefined,
  ownerDocument: Document = document,
): HTMLElement | undefined {
  if (!locator) return undefined;
  const byId = locator.id ? ownerDocument.getElementById(locator.id) : null;
  if (byId instanceof HTMLElement) return byId;

  if (!locator.name) return undefined;
  return Array.from(ownerDocument.getElementsByTagName(locator.tagName)).find(
    (element) => element.getAttribute("name") === locator.name,
  );
}
