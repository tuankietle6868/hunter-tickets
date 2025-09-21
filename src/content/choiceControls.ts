import { canonicalizeOptionText, matchProfileToOption, type SelectOption } from "./selectOptions";

const CHECKBOX_SELECTOR = 'input[type="checkbox"]';
const CUSTOM_OPTION_SELECTOR = '[role="option"], [role="menuitemradio"], [data-option-value]';

function textContentOf(element: Element | null): string {
  return element?.textContent?.trim().replace(/\s+/g, " ") ?? "";
}

function checkboxGroup(input: HTMLInputElement): HTMLInputElement[] {
  const container = input.closest("fieldset, [role='group']");
  const candidates = Array.from(
    (container ?? input.form ?? input.ownerDocument).querySelectorAll<HTMLInputElement>(CHECKBOX_SELECTOR),
  );
  if (container) return candidates;
  return input.name
    ? candidates.filter((candidate) => candidate.name === input.name && candidate.form === input.form)
    : [input];
}

function checkboxOption(input: HTMLInputElement, index: number): SelectOption {
  const label = input.labels?.[0] ?? input.closest("label");
  return {
    value: input.value,
    text: textContentOf(label) || input.getAttribute("aria-label") || input.value,
    index,
    selected: input.checked,
    disabled: input.disabled || input.getAttribute("aria-disabled") === "true",
  };
}

/** Splits an intentional multi-value profile entry while preserving ordinary single values. */
function requestedValues(value: string, options: readonly SelectOption[]): string[] {
  if (matchProfileToOption(value, options)) return [value];
  return value
    .split(/[;,\n]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Checks every option named in a semicolon-, comma-, or newline-separated
 * profile value. It resolves all requested options before changing the DOM.
 */
export function fillMultiCheckboxGroup(input: HTMLInputElement, value: string): boolean {
  const inputs = checkboxGroup(input);
  const options = inputs.map(checkboxOption);
  const wanted = requestedValues(value, options);
  if (wanted.length === 0) return false;

  const matches = wanted.map((requested) => matchProfileToOption(requested, options));
  if (matches.some((option) => !option)) return false;

  for (const option of matches) {
    const checkbox = inputs[option!.index];
    if (checkbox.checked) continue;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

export function verifyMultiCheckboxGroup(input: HTMLInputElement, value: string): boolean {
  const inputs = checkboxGroup(input);
  const options = inputs.map(checkboxOption);
  const wanted = requestedValues(value, options);
  if (wanted.length === 0) return false;
  return wanted.every((requested) => {
    const match = matchProfileToOption(requested, options);
    return Boolean(match && inputs[match.index].checked);
  });
}

function listboxesFor(control: HTMLElement): HTMLElement[] {
  const ids = ["aria-controls", "aria-owns"]
    .flatMap((attribute) => control.getAttribute(attribute)?.trim().split(/\s+/) ?? [])
    .map((id) => control.ownerDocument.getElementById(id))
    .filter((element): element is HTMLElement => Boolean(element));
  return ids.length > 0
    ? ids
    : Array.from(control.ownerDocument.querySelectorAll<HTMLElement>("[role='listbox']"));
}

function customOptions(control: HTMLElement): HTMLElement[] {
  return listboxesFor(control).flatMap((listbox) =>
    Array.from(listbox.querySelectorAll<HTMLElement>(CUSTOM_OPTION_SELECTOR)).filter(
      (option) => !option.closest("[hidden], [aria-hidden='true']"),
    ),
  );
}

function customOption(option: HTMLElement, index: number): SelectOption {
  const text = textContentOf(option) || option.getAttribute("aria-label") || "";
  return {
    // ARIA options do not require a value attribute; their text is the value
    // in that common case and must not be mistaken for a native placeholder.
    value: option.getAttribute("data-option-value") ?? option.getAttribute("value") ?? text,
    text,
    index,
    selected: option.getAttribute("aria-selected") === "true" || option.getAttribute("aria-checked") === "true",
    disabled: option.getAttribute("aria-disabled") === "true" || option.hasAttribute("disabled"),
  };
}

function controlHasExpectedValue(control: HTMLElement, expected: string): boolean {
  const expectedKey = canonicalizeOptionText(expected);
  const values = [
    control instanceof HTMLInputElement ? control.value : "",
    control.getAttribute("data-value") ?? "",
    textContentOf(control),
  ];
  const activeId = control.getAttribute("aria-activedescendant");
  if (activeId) values.push(textContentOf(control.ownerDocument.getElementById(activeId)));
  return values.some((value) => canonicalizeOptionText(value) === expectedKey);
}

/**
 * Some component libraries render a combobox trigger or option as a bare
 * button inside a form. Prevent only that button's implicit submit default;
 * click handlers still receive the event and update the component normally.
 */
function clickWithoutImplicitSubmit(element: HTMLElement): void {
  const form = element.closest("form");
  if (element instanceof HTMLButtonElement && !element.hasAttribute("type") && form) {
    form.addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true });
  }
  element.click();
}

/** Opens an ARIA combobox/listbox and selects an enabled option by visible text. */
export async function fillCustomSelectByText(control: HTMLElement, value: string): Promise<boolean> {
  clickWithoutImplicitSubmit(control);
  // Many React/Vue components mount their portal listbox in the following frame.
  await new Promise<void>((resolve) => {
    const view = control.ownerDocument.defaultView;
    if (view) view.requestAnimationFrame(() => resolve());
    else resolve();
  });
  const elements = customOptions(control);
  const match = matchProfileToOption(value, elements.map(customOption));
  if (!match) return false;
  clickWithoutImplicitSubmit(elements[match.index]);
  return true;
}

/** Verifies the selected ARIA option, with a closed-listbox control-value fallback. */
export function verifyCustomSelectByText(control: HTMLElement, value: string): boolean {
  const elements = customOptions(control);
  const selected = elements.find(
    (option) =>
      (option.getAttribute("aria-selected") === "true" || option.getAttribute("aria-checked") === "true") &&
      canonicalizeOptionText(textContentOf(option)) === canonicalizeOptionText(value),
  );
  return Boolean(selected) || controlHasExpectedValue(control, value);
}
