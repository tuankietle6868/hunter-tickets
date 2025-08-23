/**
 * Normalizes text for consistent field matching.
 *
 * It lowercases text, removes leading/trailing whitespace, and collapses each
 * run of whitespace to a single space.
 */
export function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}
