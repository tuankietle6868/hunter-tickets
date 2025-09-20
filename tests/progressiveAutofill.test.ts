import { afterEach, describe, expect, it, vi } from "vitest";

import type { IFormAdapter } from "../src/content/adapters/IFormAdapter";
import { showAutofillOverlay, OVERLAY_HOST_ID } from "../src/content/overlayUI";
import { runGenericAutofill } from "../src/content/pipeline";
import type { DetectedField } from "../src/shared/types";

describe("progressive autofill", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("shows an independently filled field before a slow cascade completes", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <input id="full-name" />
      <select id="province"><option value=""></option><option value="Hồ Chí Minh">Hồ Chí Minh</option></select>
    `;
    const fullName = document.querySelector<HTMLInputElement>("#full-name")!;
    const province = document.querySelector<HTMLSelectElement>("#province")!;
    let reportIndependent!: (field: DetectedField) => void;
    const independentReady = new Promise<DetectedField>((resolve) => {
      reportIndependent = resolve;
    });
    const adapter: IFormAdapter = {
      isApplicable: () => true,
      findQuestions: () => [fullName, province],
      getQuestionText: (question) => ({
        labelText: question === fullName ? "Họ và tên" : "Tỉnh",
      }),
      findInput: (question) => question,
      setValue: (input, value) => {
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) input.value = value;
      },
      verifyValue: async (input, expected) => {
        if (input === province) await new Promise((resolve) => setTimeout(resolve, 3_000));
        return input instanceof HTMLInputElement || input instanceof HTMLSelectElement
          ? input.value === expected
          : false;
      },
    };

    const completion = runGenericAutofill(
      { fullName: "Nguyễn Văn An", province: "Hồ Chí Minh" },
      adapter,
      { onIndependentFieldComplete: reportIndependent },
    );
    const completedField = await independentReady;
    showAutofillOverlay([completedField], document, undefined, { pendingCascade: true });

    const panel = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    expect(panel?.textContent).toContain("✓ Matched");
    expect(province.value).toBe("Hồ Chí Minh");

    await vi.advanceTimersByTimeAsync(3_000);
    await completion;
  });
});
