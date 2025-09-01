import type { FieldSignals } from "../../shared/types";
import { setNativeValue } from "../filler";
import { verifyValue } from "../validator";
import type { IFormAdapter, QuestionBlock } from "./IFormAdapter";

const EDITABLE_CONTROL_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [role='combobox'], button[aria-haspopup='listbox']";
const QUESTION_SELECTOR =
  "input:not([type='hidden']):not([type='submit']):not([type='radio']), textarea, select, [role='combobox'], button[aria-haspopup='listbox']";
const RADIO_SELECTOR = 'input[type="radio"]';

function textContentOf(element: Element | null): string | undefined {
  const text = element?.textContent?.trim().replace(/\s+/g, " ");
  return text || undefined;
}

function getControl(question: QuestionBlock): HTMLElement {
  if (question.matches(EDITABLE_CONTROL_SELECTOR)) {
    return question;
  }

  return question.querySelector<HTMLElement>(EDITABLE_CONTROL_SELECTOR) ?? question;
}

function normalizeOption(value: string): string {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .trim();
}

function genderKind(value: string): "male" | "female" | "other" | undefined {
  const normalized = normalizeOption(value);
  if (/(^|\s)(nam|male|m)(\s|$)/.test(normalized)) return "male";
  if (/(^|\s)(nu|female|f)(\s|$)/.test(normalized)) return "female";
  if (/(khac|other|nonbinary|non-binary)/.test(normalized)) return "other";
  return undefined;
}

function radioOptionText(input: HTMLInputElement): string {
  const label = input.labels?.[0] ?? input.closest("label");
  return [input.value, textContentOf(label), input.getAttribute("aria-label")]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function isMatchingRadioOption(input: HTMLInputElement, value: string): boolean {
  const wantedKind = genderKind(value);
  const optionText = radioOptionText(input);
  return wantedKind
    ? genderKind(optionText) === wantedKind
    : normalizeOption(optionText) === normalizeOption(value);
}

function radioGroupInputs(input: HTMLInputElement): HTMLInputElement[] {
  if (!input.name) return [input];
  return Array.from(input.ownerDocument.querySelectorAll<HTMLInputElement>(RADIO_SELECTOR)).filter(
    (option) => option.name === input.name,
  );
}

/** Extracts matching signals from standard HTML form controls and labels. */
export class GenericHtmlAdapter implements IFormAdapter {
  isApplicable(): boolean {
    return document.querySelector(QUESTION_SELECTOR) !== null;
  }

  findQuestions(): QuestionBlock[] {
    const standardControls = Array.from(document.querySelectorAll<HTMLElement>(QUESTION_SELECTOR));
    const firstRadioInEachGroup = Array.from(
      document.querySelectorAll<HTMLInputElement>(RADIO_SELECTOR),
    ).filter((radio, index, radios) => {
      return (
        !radio.name || radios.findIndex((candidate) => candidate.name === radio.name) === index
      );
    });
    return [...standardControls, ...firstRadioInEachGroup];
  }

  /**
   * Reads a standard `label[for]` first, then a wrapping label. If neither is
   * available, the control's ARIA label, placeholder, name, or id is used as
   * a low-information fallback.
   */
  getQuestionText(question: QuestionBlock): FieldSignals {
    const control = getControl(question);
    const associatedLabel = control.id
      ? Array.from(control.ownerDocument.querySelectorAll<HTMLLabelElement>("label[for]")).find(
          (label) => label.htmlFor === control.id,
        )
      : undefined;
    const label = associatedLabel ?? control.closest("label");
    const groupLabel =
      control instanceof HTMLInputElement && control.type === "radio"
        ? textContentOf(control.closest("fieldset")?.querySelector("legend"))
        : undefined;
    const labelText = textContentOf(label);
    const fallbackText =
      control.getAttribute("aria-label")?.trim() ||
      control.getAttribute("placeholder")?.trim() ||
      control.getAttribute("name")?.trim() ||
      control.id ||
      undefined;

    return {
      visibleQuestionText: groupLabel ?? labelText ?? fallbackText,
      labelText: groupLabel ?? labelText,
      ariaLabel: control.getAttribute("aria-label") ?? undefined,
      placeholder: control.getAttribute("placeholder") ?? undefined,
      name: control.getAttribute("name") ?? undefined,
      id: control.id || undefined,
      autocomplete: control.getAttribute("autocomplete") ?? undefined,
      inputType: control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase(),
    };
  }

  findInput(question: QuestionBlock): HTMLElement | null {
    return getControl(question);
  }

  setValue(input: HTMLElement, value: string): void {
    if (input instanceof HTMLInputElement && input.type === "radio") {
      const option = radioGroupInputs(input).find((candidate) =>
        isMatchingRadioOption(candidate, value),
      );
      if (!option) return;
      option.checked = true;
      option.dispatchEvent(new Event("input", { bubbles: true }));
      option.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      setNativeValue(input, value);
    }
  }

  verifyValue(input: HTMLElement, expected: string): boolean {
    if (input instanceof HTMLInputElement && input.type === "radio") {
      return radioGroupInputs(input).some(
        (option) => option.checked && isMatchingRadioOption(option, expected),
      );
    }
    return (
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
      verifyValue(input, expected)
    );
  }
}
