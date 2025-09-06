/** A serialisable snapshot of one native `<option>` element. */
export interface SelectOption {
  value: string;
  text: string;
  index: number;
  selected: boolean;
}

/** Extracts every option from a native select, including options in optgroups. */
export function extractOptions(select: HTMLSelectElement): SelectOption[] {
  return Array.from(select.options, (option) => ({
    value: option.value,
    text: option.text.trim(),
    index: option.index,
    selected: option.selected,
  }));
}

/** Normalizes human-readable option text for exact, locale-tolerant matching. */
export function normalizeOptionText(value: string): string {
  return stripDiacritics(normalize(value));
}

/**
 * Finds an option by exact normalized visible text, then by its normalized
 * `value` attribute when display text and profile data use different forms.
 */
export function matchProfileToOption(
  profileValue: string,
  options: readonly SelectOption[],
): SelectOption | undefined {
  const normalizedProfileValue = normalizeOptionText(profileValue);
  return (
    options.find((option) => normalizeOptionText(option.text) === normalizedProfileValue) ??
    options.find((option) => normalizeOptionText(option.value) === normalizedProfileValue)
  );
}
import { normalize, stripDiacritics } from "../shared/normalizer";
