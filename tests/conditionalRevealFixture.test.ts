import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { observeDynamicFields } from "../src/content/dynamicFields";
import { runGenericAutofill } from "../src/content/pipeline";

describe("conditional-reveal fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("scans and fills the guest name field after the conditional option reveals it", async () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/conditional-reveal.html",
      "utf8",
    );
    const form = document.querySelector<HTMLFormElement>("#conditional-reveal-form")!;
    const attendanceMode = document.querySelector<HTMLSelectElement>("#attendance-mode")!;
    const conditionalFields = document.querySelector<HTMLElement>("#conditional-fields")!;
    let resolveRescan!: () => void;
    const rescanned = new Promise<void>((resolve) => {
      resolveRescan = resolve;
    });
    const stop = observeDynamicFields(
      form,
      () => {
        void runGenericAutofill({ fullName: "Nguyễn Văn An" }).then((results) => {
          if (results.some((field) => field.elementRef.deref()?.id === "guest-name"))
            resolveRescan();
        });
      },
      0,
    );

    expect(document.querySelector("#guest-name")).toBeNull();
    await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    attendanceMode.addEventListener("change", () => {
      conditionalFields.insertAdjacentHTML(
        "beforeend",
        '<label for="guest-name">Tên người đi cùng <input id="guest-name" name="guest-name" type="text" autocomplete="name" /></label>',
      );
    });
    attendanceMode.value = "with-guest";
    attendanceMode.dispatchEvent(new Event("change", { bubbles: true }));
    await rescanned;

    expect(document.querySelector<HTMLInputElement>("#guest-name")?.value).toBe("Nguyễn Văn An");
    stop();
  });
});
