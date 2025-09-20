import { createDebouncedObserver } from "./debouncedObserver";

/** Default debounce for a form framework that renders a question in several DOM mutations. */
export const DYNAMIC_FIELD_RESCAN_DEBOUNCE_MS = 200;

/**
 * Observes only the form/question root for dynamically rendered controls.
 * The returned cleanup function must be called when the page root changes.
 */
export function observeDynamicFields(
  root: Element,
  onRescan: () => void,
  debounceMs = DYNAMIC_FIELD_RESCAN_DEBOUNCE_MS,
): () => void {
  return createDebouncedObserver(root, (mutations) => {
    if (!mutations.some((mutation) => mutation.type === "childList" && mutation.addedNodes.length > 0)) {
      return;
    }
    onRescan();
  }, { childList: true, subtree: true, debounceMs });
}

/**
 * Returns the smallest stable root that contains dynamically-added questions.
 * Google Forms may replace its entire question list between pages, so observe
 * its main respondent container rather than the list node itself.
 */
export function findDynamicFieldRoot(ownerDocument: Document = document): Element | null {
  return (
    ownerDocument.querySelector("form") ??
    ownerDocument.querySelector('main[role="main"]') ??
    ownerDocument.querySelector('[role="list"]')
  );
}
