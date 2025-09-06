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
 * Finds the option whose visible text exactly matches a profile value after
 * normalisation. Exact matching keeps numeric choices such as `2000` safe.
 */
export function matchProfileToOption(
  profileValue: string,
  options: readonly SelectOption[],
): SelectOption | undefined {
  const normalizedProfileValue = normalizeOptionText(profileValue);
  return options.find((option) => normalizeOptionText(option.text) === normalizedProfileValue);
}
import { normalize, stripDiacritics } from "../shared/normalizer";
