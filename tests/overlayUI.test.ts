import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OVERLAY_HOST_ID,
  OVERLAY_PANEL_ID,
  scrollToAndHighlightField,
  showAutofillOverlay,
} from "../src/content/overlayUI";
import type { DetectedField } from "../src/shared/types";

describe("Autofill overlay", () => {
  afterEach(() => document.body.replaceChildren());

  it("renders inside a Shadow DOM isolated from page CSS", () => {
    document.head.innerHTML = `<style>.panel { display: none !important; color: red !important; }</style>`;

    showAutofillOverlay([]);

    const host = document.getElementById(OVERLAY_HOST_ID);
    const panel = host?.shadowRoot?.getElementById(OVERLAY_PANEL_ID);
    expect(host?.shadowRoot).not.toBeNull();
    expect(panel?.textContent).toContain("Đã hoàn tất điền form");
    expect(host?.style.position).toBe("fixed");
    expect(document.querySelector(".panel")).toBeNull();
  });

  it("replaces the previous overlay instead of stacking notices", () => {
    showAutofillOverlay([]);
    showAutofillOverlay([]);
    expect(document.querySelectorAll(`#${OVERLAY_HOST_ID}`)).toHaveLength(1);
  });

  it("reminds the user to submit the original form and has no submit action", () => {
    showAutofillOverlay([]);

    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    expect(shadow?.textContent).toContain("Hãy tự kiểm tra và bấm Submit gốc của form.");
    expect(shadow?.querySelectorAll('button[type="submit"]')).toHaveLength(0);
  });

  it("lists each scanned field with a clear match status", () => {
    const results = [
      {
        candidateType: "FULL_NAME",
        confidence: 94,
        signals: { labelText: "Họ tên người đăng ký" },
        status: "filled",
      },
      {
        candidateType: "UNKNOWN",
        confidence: 12,
        signals: { labelText: "Ghi chú" },
        status: "skipped",
      },
    ] as DetectedField[];

    showAutofillOverlay(results);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("Họ tên người đăng ký");
    expect(text).toContain("✓ Matched 94%");
    expect(text).toContain("Ghi chú");
    expect(text).toContain("○ Not found");
  });

  it("runs the supplied scan and refill actions from the overlay buttons", () => {
    const onRescan = vi.fn();
    const onRefill = vi.fn();
    showAutofillOverlay([], document, { onRescan, onRefill });

    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    (shadow?.querySelector('[data-overlay-action="rescan"]') as HTMLButtonElement).click();

    showAutofillOverlay([], document, { onRescan, onRefill });
    const refreshedShadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    (refreshedShadow?.querySelector('[data-overlay-action="refill"]') as HTMLButtonElement).click();

    expect(onRescan).toHaveBeenCalledOnce();
    expect(onRefill).toHaveBeenCalledOnce();
  });

  it("scrolls to and highlights the corresponding input when a field row is clicked", () => {
    const input = document.createElement("input");
    const scrollIntoView = vi.fn();
    input.scrollIntoView = scrollIntoView;
    document.body.append(input);
    const emailField = {
      elementRef: new WeakRef(input),
      candidateType: "EMAIL",
      confidence: 98,
      signals: { labelText: "Email" },
      status: "filled",
    } as DetectedField;

    showAutofillOverlay([emailField], document, {
      onRescan: vi.fn(),
      onRefill: vi.fn(),
      onFieldSelect: scrollToAndHighlightField,
    });

    const row = document
      .getElementById(OVERLAY_HOST_ID)
      ?.shadowRoot?.querySelector<HTMLElement>('[data-field-index="0"]');
    row?.click();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(input.style.outline).toBe("3px solid #2563eb");
  });
});
