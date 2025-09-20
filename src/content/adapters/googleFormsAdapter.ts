import type { FieldSignals } from "../../shared/types";
import { setNativeValue } from "../filler";
import { verifyValue } from "../validator";
import type { IFormAdapter, QuestionBlock } from "./IFormAdapter";

const QUESTION_SELECTOR = '[role="list"] > [role="listitem"]';
const QUESTION_HEADING_SELECTOR = '[role="heading"]';
const SUPPORTED_CONTROL_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], input:not([type]), textarea';
const RADIO_SELECTOR = '[role="radio"]';

function normalizeText(element: Element | null): string | undefined {
  const text = element?.textContent?.trim().replace(/\s+/g, " ");
  return text || undefined;
}

function resolveIdReferences(input: HTMLElement, attribute: string): string | undefined {
  const ids = input.getAttribute(attribute)?.trim().split(/\s+/) ?? [];
  const text = ids
    .map((id) => normalizeText(input.ownerDocument.getElementById(id)))
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

function isMatchingRadioOption(option: HTMLElement, value: string): boolean {
  const optionText = [option.getAttribute("aria-label"), normalizeText(option)]
    .filter((text): text is string => Boolean(text))
    .join(" ");
  const wantedKind = genderKind(value);
  return wantedKind
    ? genderKind(optionText) === wantedKind
    : normalizeOption(optionText) === normalizeOption(value);
}

function radioOptions(input: HTMLElement): HTMLElement[] {
  return Array.from(
    input.closest(QUESTION_SELECTOR)?.querySelectorAll<HTMLElement>(RADIO_SELECTOR) ?? [],
  );
}

function afterNextAnimationFrame(ownerDocument: Document): Promise<void> {
  const view = ownerDocument.defaultView;

  if (!view) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    view.requestAnimationFrame(() => resolve());
  });
}

function isCurrentPageQuestion(question: HTMLElement): boolean {
  return !question.closest('[aria-hidden="true"], [hidden]');
}

/**
 * Reads the published Google Forms respondent DOM using stable ARIA roles.
 * Generated CSS classes and Google `js*` attributes are intentionally ignored.
 */
export class GoogleFormsAdapter implements IFormAdapter {
  isApplicable(): boolean {
    return document.querySelector(QUESTION_SELECTOR) !== null;
  }

  /**
   * Returns every direct item of the respondent question list, including
   * question kinds which are not yet editable by this adapter (for example,
   * radio groups). Filtering happens in `findInput`, not during the scan.
   */
  findQuestions(): QuestionBlock[] {
    return Array.from(document.querySelectorAll<HTMLElement>(QUESTION_SELECTOR)).filter(
      isCurrentPageQuestion,
    );
  }

  getQuestionText(question: QuestionBlock): FieldSignals {
    const input = this.findInput(question);
    const headingText = normalizeText(question.querySelector(QUESTION_HEADING_SELECTOR));
    const ariaLabelledByText = input ? resolveIdReferences(input, "aria-labelledby") : undefined;

    return {
      visibleQuestionText: headingText ?? ariaLabelledByText,
      labelText: headingText,
      ariaLabel: input?.getAttribute("aria-label") ?? undefined,
      ariaLabelledByText,
      placeholder: input?.getAttribute("placeholder") ?? undefined,
      name: input?.getAttribute("name") ?? undefined,
      id: input?.id || undefined,
      autocomplete: input?.getAttribute("autocomplete") ?? undefined,
      surroundingText: input ? resolveIdReferences(input, "aria-describedby") : undefined,
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
    if (input.getAttribute("role") === "radio") {
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
    // Forms may commit the input event and replace its React-controlled node
    // in the following frame. Check only after that reconciliation point.
    await afterNextAnimationFrame(input.ownerDocument);

    if (input.getAttribute("role") === "radio") {
      return radioOptions(input).some(
        (option) =>
          option.getAttribute("aria-checked") === "true" && isMatchingRadioOption(option, expected),
      );
    }

    return (
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
      verifyValue(input, expected)
    );
  }
}
