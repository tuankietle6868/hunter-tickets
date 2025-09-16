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
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.type === "childList" && mutation.addedNodes.length > 0)) {
      return;
    }
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      onRescan();
    }, debounceMs);
  });

  observer.observe(root, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
}

/** Returns the smallest stable root that contains dynamically-added questions. */
export function findDynamicFieldRoot(ownerDocument: Document = document): Element | null {
  return ownerDocument.querySelector("form") ?? ownerDocument.querySelector('[role="list"]');
}
