/**
 * Normalizes text for consistent field matching.
 *
 * It lowercases text, removes leading/trailing whitespace, and collapses each
 * run of whitespace to a single space.
 */
export function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Removes Vietnamese diacritics and returns a lowercase string for matching. */
export function stripDiacritics(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");
}

/** Removes common form-question decorations that do not describe the field. */
export function cleanQuestionText(value: string): string {
  return value
    .replace(/^\s*\d+\s*\.\s*/, "")
    .replace(/\*/g, "")
    .replace(/\(\s*bắt\s+buộc\s*\)/giu, "")
    .trim()
    .replace(/\s+/g, " ");
}
