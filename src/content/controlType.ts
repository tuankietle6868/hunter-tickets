import type { CheckboxMode, ControlType, SelectMode } from "../shared/types";

const DATE_INPUT_TYPES = new Set(["date", "datetime-local", "month", "time", "week"]);

function hasDatePickerSemantics(element: HTMLElement): boolean {
  const role = element.getAttribute("role");
  const hasDateHint = /date|ngay|birth|sinh/i.test(
    [element.getAttribute("aria-label"), element.getAttribute("placeholder")]
      .filter((value): value is string => Boolean(value))
      .join(" "),
  );
  return (
    role === "datepicker" ||
    element.hasAttribute("data-datepicker") ||
    (element.getAttribute("aria-haspopup") === "dialog" && hasDateHint) ||
    (element instanceof HTMLInputElement &&
      element.type === "text" &&
      hasDateHint &&
      (/\d/.test(element.placeholder) || element.getAttribute("role") === "combobox"))
  );
}

/** Classifies native controls and common ARIA component-library patterns. */
export function classifyControl(element: HTMLElement | null | undefined): ControlType {
  if (!element) return "UNKNOWN";
  if (element instanceof HTMLTextAreaElement) return "TEXTAREA";
  if (element instanceof HTMLSelectElement) return "SELECT";

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") return "CHECKBOX";
    if (element.type === "radio") return "RADIO";
    if (DATE_INPUT_TYPES.has(element.type) || hasDatePickerSemantics(element)) return "DATE_PICKER";
    if (
      element.getAttribute("role") === "combobox" ||
      element.getAttribute("role") === "listbox" ||
      element.getAttribute("aria-haspopup") === "listbox"
    ) {
      return "CUSTOM_SELECT";
    }
    return "INPUT";
  }

  const role = element.getAttribute("role");
  if (role === "checkbox") return "CHECKBOX";
  if (role === "radio") return "RADIO";
  if (hasDatePickerSemantics(element)) return "DATE_PICKER";
  if (
    role === "combobox" ||
    role === "listbox" ||
    element.getAttribute("aria-haspopup") === "listbox"
  ) {
    return "CUSTOM_SELECT";
  }
  return "UNKNOWN";
}

/** Returns the native selection mode; ARIA custom selects are handled separately. */
export function getNativeSelectMode(
  element: HTMLElement | null | undefined,
): SelectMode | undefined {
  if (!(element instanceof HTMLSelectElement)) return undefined;
  return element.multiple ? "multiple" : "single";
}

/** Distinguishes a boolean checkbox from a multi-choice checkbox group. */
export function getNativeCheckboxMode(
  element: HTMLElement | null | undefined,
): CheckboxMode | undefined {
  if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") return undefined;

  const container = element.closest("fieldset, [role='group']");
  const candidates = Array.from(
    (container ?? element.ownerDocument).querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ),
  ).filter((candidate) => {
    if (container) return true;
    return candidate.name === element.name && candidate.form === element.form;
  });
  return candidates.length > 1 ? "multiple" : "boolean";
}
