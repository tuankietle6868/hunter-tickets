import { normalize } from "../shared/normalizer";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * Confirms that a control retained the filled value after normalizing casing
 * and whitespace. This lets callers detect framework renders that revert it.
 */
export function verifyValue(element: EditableElement, expected: string): boolean {
  return normalize(element.value) === normalize(expected);
}
