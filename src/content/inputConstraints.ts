/** Returns whether a text value can be assigned without violating declared HTML constraints. */
export function acceptsFormattedValue(input: HTMLElement, value: string): boolean {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    const maxLength = input.getAttribute("maxlength");
    const parsedMaxLength = maxLength === null ? undefined : Number(maxLength);
    if (
      parsedMaxLength !== undefined &&
      Number.isInteger(parsedMaxLength) &&
      parsedMaxLength >= 0 &&
      value.length > parsedMaxLength
    ) {
      return false;
    }
  }

  if (input instanceof HTMLInputElement && input.pattern) {
    try {
      return new RegExp(`^(?:${input.pattern})$`, "u").test(value);
    } catch {
      // A malformed page pattern must not prevent a safe normal fill.
      return true;
    }
  }

  return true;
}
