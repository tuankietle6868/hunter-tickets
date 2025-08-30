import type { FieldSignals } from "../../shared/types";
import { setNativeValue } from "../filler";
import { verifyValue } from "../validator";
import type { IFormAdapter, QuestionBlock } from "./IFormAdapter";

const QUESTION_SELECTOR = '[role="list"] > [role="listitem"]';
const QUESTION_HEADING_SELECTOR = '[role="heading"]';
const SUPPORTED_CONTROL_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea';

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

function afterNextAnimationFrame(ownerDocument: Document): Promise<void> {
  const view = ownerDocument.defaultView;

  if (!view) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    view.requestAnimationFrame(() => resolve());
  });
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
    return Array.from(document.querySelectorAll<HTMLElement>(QUESTION_SELECTOR));
  }

  getQuestionText(question: QuestionBlock): FieldSignals {
    const input = this.findInput(question);
    const headingText = normalizeText(question.querySelector(QUESTION_HEADING_SELECTOR));
    const ariaLabelledByText = input
      ? resolveIdReferences(input, "aria-labelledby")
      : undefined;

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
        input instanceof HTMLInputElement ? input.type : input ? "textarea" : undefined,
    };
  }

  findInput(question: QuestionBlock): HTMLElement | null {
    return question.querySelector<HTMLElement>(SUPPORTED_CONTROL_SELECTOR);
  }

  setValue(input: HTMLElement, value: string): void {
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      setNativeValue(input, value);
    }
  }

  async verifyValue(input: HTMLElement, expected: string): Promise<boolean> {
    // Forms may commit the input event and replace its React-controlled node
    // in the following frame. Check only after that reconciliation point.
    await afterNextAnimationFrame(input.ownerDocument);

    return (
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
      verifyValue(input, expected)
    );
  }
}
