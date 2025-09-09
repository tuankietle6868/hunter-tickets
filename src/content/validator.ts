import {
  canonicalizeDateValue,
  extractBirthYear,
  type SeparateDateSelects,
} from "./dateValue";
import { normalize } from "../shared/normalizer";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * Confirms that a control retained the filled value after normalizing casing
 * and whitespace. This lets callers detect framework renders that revert it.
 */
export function verifyValue(element: EditableElement, expected: string): boolean {
  const actualDate = canonicalizeDateValue(element.value);
  const expectedDate = canonicalizeDateValue(expected);
  if (actualDate && expectedDate) return actualDate === expectedDate;

  return normalize(element.value) === normalize(expected);
}

/** Verifies all three independent date selects against the same canonical date. */
export function verifySeparateDateSelects(
  selects: SeparateDateSelects,
  expected: string,
): boolean {
  const actual = canonicalizeDateValue(
    `${selects.year.value}-${selects.month.value}-${selects.day.value}`,
  );
  return actual !== undefined && actual === canonicalizeDateValue(expected);
}

/** Verifies a standalone birth-year select without requiring day or month fields. */
export function verifyBirthYearSelect(yearSelect: HTMLSelectElement, expected: string): boolean {
  return (
    extractBirthYear(yearSelect.value) !== undefined &&
    extractBirthYear(yearSelect.value) === extractBirthYear(expected)
  );
}
