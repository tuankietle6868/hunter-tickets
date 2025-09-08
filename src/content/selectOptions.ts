import type { DetectedField } from "../shared/types";

/** A serialisable snapshot of one native `<option>` element. */
export interface SelectOption {
  value: string;
  text: string;
  index: number;
  selected: boolean;
  disabled: boolean;
}

/**
 * Waits until a native select is enabled by the page. This makes cascading
 * controls detectable from their actual disabled state, not their DOM order.
 */
export function waitForNativeSelectEnabled(select: HTMLSelectElement): Promise<void> {
  if (!select.disabled) return Promise.resolve();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!select.disabled) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(select, { attributes: true, attributeFilter: ["disabled"] });
  });
}

/** Maximum time to wait for a dependent native select to react to its parent. */
export const CASCADE_CHILD_WAIT_TIMEOUT_MS = 2_500;

/** The bounded outcome of waiting for a dependent select. */
export type CascadeChildWaitResult = "ready" | "timeout";

/** A discovered select control and the option value that should be applied to it. */
export interface CascadingSelectStep {
  select: HTMLSelectElement;
  value: string;
  /** The scan result to surface when this dependent field cannot be populated. */
  detectedField?: DetectedField;
}

/** One step's outcome when filling a discovered cascade. */
export interface CascadingSelectChainResult {
  step: CascadingSelectStep;
  status: "filled" | "cascade_timeout";
}

function setNativeSelectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Selects a parent value, notifies the form, then waits for its dependent
 * select to become usable. Some forms keep the child enabled and only replace
 * its options, so option mutations are treated as a ready signal too.
 *
 * The promise always settles within `timeoutMs`. A timeout is deliberately
 * non-fatal: callers can inspect the child and decide whether it is safe to
 * continue filling it.
 */
export function fillParentThenWaitChild(
  parent: HTMLSelectElement,
  value: string,
  child: HTMLSelectElement,
  timeoutMs = CASCADE_CHILD_WAIT_TIMEOUT_MS,
): Promise<CascadeChildWaitResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: CascadeChildWaitResult) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      resolve(result);
    };

    const observer = new MutationObserver((mutations) => {
      if (!child.disabled) {
        finish("ready");
        return;
      }

      // A child may remain enabled while its list is refreshed. Watching the
      // option subtree catches replacement, insertion, and option updates.
      if (
        mutations.some(
          (mutation) =>
            mutation.type === "childList" ||
            mutation.type === "characterData" ||
            (mutation.type === "attributes" && mutation.target !== child),
        )
      ) {
        finish("ready");
      }
    });

    observer.observe(child, {
      attributes: true,
      attributeFilter: ["disabled", "value", "selected", "label"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    const timeoutId = setTimeout(() => finish("timeout"), timeoutMs);

    // Start observing before dispatching so a synchronous page listener cannot
    // update the child between filling the parent and registering the observer.
    setNativeSelectValue(parent, value);
  });
}

/**
 * Fills every select in a discovered cascade, regardless of how many levels
 * the current form exposes. Each non-final step waits for the next discovered
 * select before the following value is applied.
 */
export async function fillCascadingSelectChain(
  steps: readonly CascadingSelectStep[],
  timeoutMs = CASCADE_CHILD_WAIT_TIMEOUT_MS,
): Promise<CascadingSelectChainResult[]> {
  const results: CascadingSelectChainResult[] = [];
  for (const [index, step] of steps.entries()) {
    const child = steps[index + 1]?.select;
    if (child) {
      const waitResult = await fillParentThenWaitChild(step.select, step.value, child, timeoutMs);
      results.push({ step, status: "filled" });
      if (waitResult === "timeout") {
        const timedOutStep = steps[index + 1];
        if (timedOutStep.detectedField) timedOutStep.detectedField.status = "cascade_timeout";
        results.push({ step: timedOutStep, status: "cascade_timeout" });
        break;
      }
    } else {
      setNativeSelectValue(step.select, step.value);
      results.push({ step, status: "filled" });
    }
  }
  return results;
}

/** Extracts every option from a native select, including options in optgroups. */
export function extractOptions(select: HTMLSelectElement): SelectOption[] {
  return Array.from(select.options, (option) => ({
    value: option.value,
    text: option.text.trim(),
    index: option.index,
    selected: option.selected,
    disabled:
      option.disabled ||
      (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
  }));
}

/** Normalizes human-readable option text for exact, locale-tolerant matching. */
export function normalizeOptionText(value: string): string {
  return stripDiacritics(normalize(value));
}

const OPTION_CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  "tp hcm": "thanh pho ho chi minh",
  tphcm: "thanh pho ho chi minh",
  "tp ho chi minh": "thanh pho ho chi minh",
  "ho chi minh": "thanh pho ho chi minh",
  "ho chi minh city": "thanh pho ho chi minh",
};

/** Maps known abbreviations and equivalent option labels to a shared key. */
export function canonicalizeOptionText(value: string): string {
  const normalized = normalizeOptionText(value).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  return OPTION_CANONICAL_ALIASES[normalized] ?? normalized;
}

function isPlaceholderOption(option: SelectOption): boolean {
  if (option.value.trim() === "") return true;
  const text = normalizeOptionText(option.text).replace(/[-–—]/g, "").trim();
  return /^(chon|vui long chon|select|please select)$/.test(text);
}

/**
 * Finds an option by exact normalized visible text, then by its normalized
 * `value` attribute when display text and profile data use different forms.
 */
export function matchProfileToOption(
  profileValue: string,
  options: readonly SelectOption[],
): SelectOption | undefined {
  const normalizedProfileValue = normalizeOptionText(profileValue);
  const availableOptions = options.filter(
    (option) => !option.disabled && !isPlaceholderOption(option),
  );
  return (
    availableOptions.find(
      (option) => normalizeOptionText(option.text) === normalizedProfileValue,
    ) ??
    availableOptions.find(
      (option) => normalizeOptionText(option.value) === normalizedProfileValue,
    ) ??
    availableOptions.find(
      (option) => canonicalizeOptionText(option.text) === canonicalizeOptionText(profileValue),
    ) ??
    availableOptions.find(
      (option) => canonicalizeOptionText(option.value) === canonicalizeOptionText(profileValue),
    )
  );
}
import { normalize, stripDiacritics } from "../shared/normalizer";
