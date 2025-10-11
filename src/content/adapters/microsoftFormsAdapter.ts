import type { FieldSignals } from "../../shared/types";
import { setNativeValue } from "../filler";
import { verifyValue } from "../validator";
import type { IFormAdapter, QuestionBlock } from "./IFormAdapter";

const QUESTION_SELECTOR = '[data-automation-id="questionItem"], [id^="QuestionId_"]';
const QUESTION_TITLE_SELECTOR = '[data-automation-id="questionTitle"]';
const SUPPORTED_CONTROL_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], input:not([type]), textarea';
const RADIO_SELECTOR = 'input[type="radio"], [role="radio"]';

function textContentOf(element: Element | null): string | undefined {
  const text = element?.textContent?.trim().replace(/\s+/g, " ");
  return text || undefined;
}

function resolveIdReferences(input: HTMLElement, attribute: string): string | undefined {
  const ids = input.getAttribute(attribute)?.trim().split(/\s+/) ?? [];
  const text = ids
    .map((id) => textContentOf(input.ownerDocument.getElementById(id)))
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return text || undefined;
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

function radioOptionText(option: HTMLElement): string {
  const nativeOption = option instanceof HTMLInputElement ? option : undefined;
  return [
    option.getAttribute("aria-label"),
    nativeOption?.value,
    textContentOf(nativeOption?.labels?.[0] ?? option.closest("label")),
    textContentOf(option),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function isMatchingRadioOption(option: HTMLElement, value: string): boolean {
  const wantedKind = genderKind(value);
  return wantedKind
    ? genderKind(radioOptionText(option)) === wantedKind
    : normalizeOption(radioOptionText(option)) === normalizeOption(value);
}

function radioOptions(input: HTMLElement): HTMLElement[] {
  const question = input.closest(QUESTION_SELECTOR);
  return Array.from(question?.querySelectorAll<HTMLElement>(RADIO_SELECTOR) ?? []);
}

function afterNextAnimationFrame(ownerDocument: Document): Promise<void> {
  const view = ownerDocument.defaultView;
  if (!view || ownerDocument.visibilityState === "hidden") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      view.clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = view.setTimeout(finish, 100);
    view.requestAnimationFrame(finish);
  });
}

function isQuestionRoot(question: HTMLElement): boolean {
  return question.parentElement?.closest(QUESTION_SELECTOR) === null;
}

/**
 * Reads Microsoft Forms respondent pages using their durable automation IDs
 * (`questionItem`, `questionTitle`, and `textInput`) and ARIA relationships.
 */
export class MicrosoftFormsAdapter implements IFormAdapter {
  isApplicable(): boolean {
    return document.querySelector(QUESTION_SELECTOR) !== null;
  }

  findQuestions(): QuestionBlock[] {
    return Array.from(document.querySelectorAll<HTMLElement>(QUESTION_SELECTOR)).filter(
      isQuestionRoot,
    );
  }

  getQuestionText(question: QuestionBlock): FieldSignals {
    const input = this.findInput(question);
    const title = textContentOf(question.querySelector(QUESTION_TITLE_SELECTOR));
    const ariaLabelledByText = input ? resolveIdReferences(input, "aria-labelledby") : undefined;

    return {
      visibleQuestionText: title ?? ariaLabelledByText,
      labelText: title,
      ariaLabel: input?.getAttribute("aria-label") ?? undefined,
      ariaLabelledByText,
      placeholder: input?.getAttribute("placeholder") ?? undefined,
      name: input?.getAttribute("name") ?? undefined,
      id: input?.id || undefined,
      autocomplete: input?.getAttribute("autocomplete") ?? undefined,
      inputType:
        input instanceof HTMLInputElement
          ? input.type
          : (input?.getAttribute("role") ?? (input ? "textarea" : undefined)),
    };
  }

  findInput(question: QuestionBlock): HTMLElement | null {
    return (
      question.querySelector<HTMLElement>(SUPPORTED_CONTROL_SELECTOR) ??
      question.querySelector<HTMLElement>(RADIO_SELECTOR)
    );
  }

  setValue(input: HTMLElement, value: string): void {
    if (input.matches(RADIO_SELECTOR)) {
      radioOptions(input)
        .find((option) => isMatchingRadioOption(option, value))
        ?.click();
      return;
    }
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      setNativeValue(input, value);
    }
  }

  async verifyValue(input: HTMLElement, expected: string): Promise<boolean> {
    await afterNextAnimationFrame(input.ownerDocument);
    if (input.matches(RADIO_SELECTOR)) {
      return radioOptions(input).some((option) => {
        const selected =
          (option instanceof HTMLInputElement && option.checked) ||
          option.getAttribute("aria-checked") === "true";
        return selected && isMatchingRadioOption(option, expected);
      });
    }
    return (
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
      verifyValue(input, expected)
    );
  }
}
