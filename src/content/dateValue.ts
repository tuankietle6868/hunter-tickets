import type { FieldType } from "../shared/types";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** The three independent native selects used by legacy birthday controls. */
export interface SeparateDateSelects {
  day: HTMLSelectElement;
  month: HTMLSelectElement;
  year: HTMLSelectElement;
}

function parseDate(value: string): DateParts | undefined {
  const match = value
    .trim()
    .match(/^(?:(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}))$/);
  if (!match) return undefined;

  const [year, month, day] = match[1]
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : [Number(match[6]), Number(match[5]), Number(match[4])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? { year, month, day }
    : undefined;
}

/** Converts supported date strings to their unambiguous ISO calendar value. */
export function canonicalizeDateValue(value: string): string | undefined {
  const parts = parseDate(value);
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : undefined;
}

/** Reads a four-digit birth year from a full date or a standalone year value. */
export function extractBirthYear(value: string): string | undefined {
  const year = parseDate(value)?.year ?? (/^\d{4}$/.test(value.trim()) ? Number(value.trim()) : undefined);
  return year ? String(year) : undefined;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function setDateSelectValue(select: HTMLSelectElement, values: readonly string[]): void {
  const option = Array.from(select.options).find(
    (candidate) => values.includes(candidate.value) || values.includes(candidate.text.trim()),
  );
  select.value = option?.value ?? values[0];
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

type TextDateFormat = "dmy-slash" | "dmy-dash" | "dmy-dot" | "ymd-dash" | "ymd-slash";

function detectTextDateFormat(input: HTMLElement): TextDateFormat | undefined {
  const hints = [
    input.getAttribute("placeholder"),
    input.getAttribute("aria-label"),
    input.getAttribute("pattern"),
  ]
    .filter((hint): hint is string => Boolean(hint))
    .join(" ")
    .toLowerCase()
    .replace(/\\/g, "")
    .replace(/\s+/g, "");

  if (/(?:dd|d)[/](?:mm|m)[/]yyyy|d\{2\}\/d\{2\}\/d\{4\}/.test(hints)) {
    return "dmy-slash";
  }
  if (/(?:dd|d)-(?:mm|m)-yyyy|d\{2\}-d\{2\}-d\{4\}/.test(hints)) {
    return "dmy-dash";
  }
  if (/(?:dd|d)\.(?:mm|m)\.yyyy|d\{2\}\.d\{2\}\.d\{4\}/.test(hints)) {
    return "dmy-dot";
  }
  if (/yyyy-(?:mm|m)-(?:dd|d)|d\{4\}-d\{2\}-d\{2\}/.test(hints)) {
    return "ymd-dash";
  }
  if (/yyyy\/(?:mm|m)\/(?:dd|d)|d\{4\}\/d\{2\}\/d\{2\}/.test(hints)) {
    return "ymd-slash";
  }
  return undefined;
}

/**
 * Fills independent day, month, and year selects from one stored date. These
 * controls are not a cascade, so each value is applied immediately with no
 * waiting between the three fields.
 */
export function fillSeparateDateSelects(value: string, selects: SeparateDateSelects): boolean {
  const parts = parseDate(value);
  if (!parts) return false;

  setDateSelectValue(selects.day, [pad(parts.day), String(parts.day)]);
  setDateSelectValue(selects.month, [pad(parts.month), String(parts.month)]);
  setDateSelectValue(selects.year, [String(parts.year)]);
  return true;
}

/**
 * Fills a standalone birth-year select. Unlike the three-part variant, this
 * intentionally has no day or month dependency.
 */
export function fillBirthYearSelect(value: string, yearSelect: HTMLSelectElement): boolean {
  const year = extractBirthYear(value);
  if (!year) return false;

  setDateSelectValue(yearSelect, [year]);
  return true;
}

/**
 * Converts a stored birthday into the format accepted by a native date input
 * or a text date field such as Google Forms' `dd/mm/yyyy` control.
 */
export function formatValueForInput(
  value: string,
  fieldType: FieldType,
  input: HTMLElement,
): string {
  if (fieldType !== "DATE_OF_BIRTH") return value;

  const parts = parseDate(value);
  if (!parts) return value;

  const iso = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  if (input instanceof HTMLInputElement && input.type === "date") return iso;

  switch (detectTextDateFormat(input)) {
    case "dmy-slash":
      return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
    case "dmy-dash":
      return `${pad(parts.day)}-${pad(parts.month)}-${parts.year}`;
    case "dmy-dot":
      return `${pad(parts.day)}.${pad(parts.month)}.${parts.year}`;
    case "ymd-slash":
      return `${parts.year}/${pad(parts.month)}/${pad(parts.day)}`;
    case "ymd-dash":
      return iso;
    default:
      // There is no declared layout, so retaining the stored ISO value is the
      // only safe choice; do not guess a locale-specific text representation.
      return value;
  }
}
