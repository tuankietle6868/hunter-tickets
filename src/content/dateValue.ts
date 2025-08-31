import type { FieldType } from "../shared/types";

interface DateParts {
  year: number;
  month: number;
  day: number;
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

function pad(value: number): string {
  return String(value).padStart(2, "0");
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

  const dateHint = [input.getAttribute("placeholder"), input.getAttribute("aria-label")]
    .filter((hint): hint is string => Boolean(hint))
    .join(" ")
    .toLowerCase();
  if (/mm\s*[-/.]\s*dd\s*[-/.]\s*yyyy/.test(dateHint)) {
    return `${pad(parts.month)}/${pad(parts.day)}/${parts.year}`;
  }
  if (/yyyy\s*[-/.]\s*mm\s*[-/.]\s*dd/.test(dateHint)) return iso;

  // Vietnamese forms commonly use a text input with `dd/mm/yyyy` as hint.
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}
