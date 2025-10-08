import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { observeDynamicFields } from "../src/content/dynamicFields";
import { OVERLAY_HOST_ID, showAutofillOverlay } from "../src/content/overlayUI";
import { runGenericAutofill } from "../src/content/pipeline";

describe("multi-step-form fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("updates the overlay to contain only fields from the visible step", async () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/multi-step-form.html",
      "utf8",
    );
    const form = document.querySelector<HTMLFormElement>("#multi-step-form")!;
    const steps = Array.from(document.querySelectorAll<HTMLElement>(".step"));
    let resolveStepTwo!: () => void;
    const stepTwoScanned = new Promise<void>((resolve) => {
      resolveStepTwo = resolve;
    });
    const rescan = async () => {
      const results = await runGenericAutofill({
        fullName: "Nguyễn Văn An",
        email: "an@example.com",
        phone: "0901234567",
      });
      showAutofillOverlay(results);
      if (results.some((field) => field.elementRef.deref()?.id === "email")) resolveStepTwo();
    };
    const stop = observeDynamicFields(form, () => void rescan(), 0);

    await rescan();
    let overlayText = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(overlayText).toContain("Họ và tên");
    expect(overlayText).not.toContain("Email");

    steps[0].hidden = true;
    steps[1].hidden = false;
    await stepTwoScanned;

    overlayText = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(overlayText).toContain("Email");
    expect(overlayText).not.toContain("Họ và tên");
    expect(document.querySelector<HTMLInputElement>("#email")?.value).toBe("an@example.com");
    stop();
  });
});
