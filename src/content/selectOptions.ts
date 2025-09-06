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
