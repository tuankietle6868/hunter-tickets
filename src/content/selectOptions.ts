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

const OPTION_CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  "tp hcm": "thanh pho ho chi minh",
  tphcm: "thanh pho ho chi minh",
  "tp ho chi minh": "thanh pho ho chi minh",
  "ho chi minh": "thanh pho ho chi minh",
  "ho chi minh city": "thanh pho ho chi minh",
};

/** Maps known abbreviations and equivalent option labels to a shared key. */
export function canonicalizeOptionText(value: string): string {
  const normalized = normalizeOptionText(value).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  return OPTION_CANONICAL_ALIASES[normalized] ?? normalized;
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
    options.find((option) => normalizeOptionText(option.value) === normalizedProfileValue) ??
    options.find(
      (option) => canonicalizeOptionText(option.text) === canonicalizeOptionText(profileValue),
    ) ??
    options.find(
      (option) => canonicalizeOptionText(option.value) === canonicalizeOptionText(profileValue),
    )
  );
}
import { normalize, stripDiacritics } from "../shared/normalizer";
