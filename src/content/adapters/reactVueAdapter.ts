import type { FieldSignals } from "../../shared/types";
import { GenericHtmlAdapter } from "./genericHtmlAdapter";
import type { QuestionBlock } from "./IFormAdapter";

const FIELD_CONTAINER_SELECTOR =
  "[role='group'], fieldset, [data-field], [data-form-field], [data-testid*='field' i]";
const FIELD_LABEL_SELECTOR =
  "[data-automation-id='questionTitle'], [data-field-label], [data-testid*='label' i], legend, [role='heading'], label";

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

function getFieldLabel(input: HTMLElement): string | undefined {
  const container = input.closest(FIELD_CONTAINER_SELECTOR);
  return textContentOf(container?.querySelector(FIELD_LABEL_SELECTOR) ?? null);
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

/**
 * Semantic adapter for React and Vue forms outside dedicated providers.
 *
 * It deliberately relies on ARIA, labels, and common field containers rather
 * than framework-generated class names, which change between builds. Native
 * input writes are inherited from GenericHtmlAdapter and verified after the
 * framework's next render frame.
 */
export class ReactVueAdapter extends GenericHtmlAdapter {
  getQuestionText(question: QuestionBlock): FieldSignals {
    const baseSignals = super.getQuestionText(question);
    const input = this.findInput(question);
    if (!input) return baseSignals;

    const ariaLabelledByText = resolveIdReferences(input, "aria-labelledby");
    const fieldLabel = getFieldLabel(input);
    const surroundingText = resolveIdReferences(input, "aria-describedby");

    return {
      ...baseSignals,
      visibleQuestionText: ariaLabelledByText ?? fieldLabel ?? baseSignals.visibleQuestionText,
      labelText: fieldLabel ?? baseSignals.labelText,
      ariaLabelledByText,
      surroundingText,
    };
  }

  async verifyValue(input: HTMLElement, expected: string): Promise<boolean> {
    await afterNextAnimationFrame(input.ownerDocument);
    return super.verifyValue(input, expected);
  }
}
