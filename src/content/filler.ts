type EditableElement = HTMLInputElement | HTMLTextAreaElement;

function getNativeValueSetter(element: EditableElement): (value: string) => void {
  let prototype: object | null = Object.getPrototypeOf(element);

  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      return descriptor.set.bind(element);
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  throw new TypeError("The form control does not provide a native value setter.");
}

/**
 * Updates a form control through its native setter and notifies both native
 * listeners and framework-controlled inputs of the change.
 */
export function setNativeValue(element: EditableElement, value: string): void {
  getNativeValueSetter(element)(value);

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
