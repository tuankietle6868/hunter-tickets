/** Options for a debounced DOM mutation observer. */
export type DebouncedObserverOptions = MutationObserverInit & {
  /** Delay after the latest mutation before notifying the caller. */
  debounceMs?: number;
};

/**
 * Observes `target` and coalesces DOM mutations before notifying `onChange`.
 * Call the returned cleanup function when the target is no longer relevant.
 */
export function createDebouncedObserver(
  target: Node,
  onChange: (mutations: MutationRecord[]) => void,
  { debounceMs = 0, ...observerOptions }: DebouncedObserverOptions,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingMutations: MutationRecord[] = [];

  const observer = new MutationObserver((mutations) => {
    pendingMutations.push(...mutations);
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const changes = pendingMutations;
      pendingMutations = [];
      onChange(changes);
    }, debounceMs);
  });

  observer.observe(target, observerOptions);
  return () => {
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    pendingMutations = [];
  };
}
