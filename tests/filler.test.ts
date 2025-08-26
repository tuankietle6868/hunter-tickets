import { afterEach, describe, expect, it } from "vitest";

import { setNativeValue } from "../src/content/filler";

describe("setNativeValue", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("sets a regular input value and dispatches input then change", () => {
    const input = document.createElement("input");
    const receivedEvents: string[] = [];
    input.addEventListener("input", () => receivedEvents.push("input"));
    input.addEventListener("change", () => receivedEvents.push("change"));
    document.body.append(input);

    setNativeValue(input, "Nguyễn Văn A");

    expect(input.value).toBe("Nguyễn Văn A");
    expect(receivedEvents).toEqual(["input", "change"]);
  });

  it("bypasses a React-like instance setter while updating the native value", () => {
    const input = document.createElement("input");
    const nativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    let reactSetterCalls = 0;
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => nativeValue?.get?.call(input) ?? "",
      set: (value: string) => {
        reactSetterCalls += 1;
        nativeValue?.set?.call(input, value);
      },
    });
    document.body.append(input);

    setNativeValue(input, "test@example.com");

    expect(input.value).toBe("test@example.com");
    expect(reactSetterCalls).toBe(0);
  });
});
