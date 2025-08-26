import type { FieldSignals } from "../../shared/types";
import { setNativeValue } from "../filler";
import { verifyValue } from "../validator";
import type { IFormAdapter, QuestionBlock } from "./IFormAdapter";

const EDITABLE_CONTROL_SELECTOR =
  "input, textarea, select, [contenteditable='true']";
const QUESTION_SELECTOR = "input:not([type='hidden']):not([type='submit']), textarea";

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

/** Extracts matching signals from standard HTML form controls and labels. */
export class GenericHtmlAdapter implements IFormAdapter {
  isApplicable(): boolean {
    return document.querySelector(QUESTION_SELECTOR) !== null;
  }

  findQuestions(): QuestionBlock[] {
    return Array.from(document.querySelectorAll<HTMLElement>(QUESTION_SELECTOR));
  }

  /**
   * Reads a standard `label[for]` first, then a wrapping label. If neither is
   * available, the control's ARIA label, placeholder, name, or id is used as
   * a low-information fallback.
   */
  getQuestionText(question: QuestionBlock): FieldSignals {
    const control = getControl(question);
    const associatedLabel = control.id
      ? Array.from(
          control.ownerDocument.querySelectorAll<HTMLLabelElement>("label[for]"),
        ).find((label) => label.htmlFor === control.id)
      : undefined;
    const label = associatedLabel ?? control.closest("label");
    const labelText = textContentOf(label);
    const fallbackText =
      control.getAttribute("aria-label")?.trim() ||
      control.getAttribute("placeholder")?.trim() ||
      control.getAttribute("name")?.trim() ||
      control.id ||
      undefined;

    return {
      visibleQuestionText: labelText ?? fallbackText,
      labelText,
      ariaLabel: control.getAttribute("aria-label") ?? undefined,
      placeholder: control.getAttribute("placeholder") ?? undefined,
      name: control.getAttribute("name") ?? undefined,
      id: control.id || undefined,
      autocomplete: control.getAttribute("autocomplete") ?? undefined,
      inputType:
        control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase(),
    };
  }

  findInput(question: QuestionBlock): HTMLElement | null {
    return getControl(question);
  }

  setValue(input: HTMLElement, value: string): void {
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      setNativeValue(input, value);
    }
  }

  verifyValue(input: HTMLElement, expected: string): boolean {
    return (
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
      verifyValue(input, expected)
    );
  }
}
