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

  it("tells the user to choose a cascading field manually after its wait times out", () => {
    const results = [
      {
        candidateType: "UNKNOWN",
        confidence: 100,
        signals: { labelText: "Phường/Xã" },
        status: "cascade_timeout",
      },
    ] as DetectedField[];

    showAutofillOverlay(results);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("Phường/Xã");
    expect(text).toContain("đang chờ / không tự chọn được — vui lòng chọn tay");
  });

  it("renders separate explanations for policy, ambiguity, and low confidence", () => {
    const results = [
      {
        candidateType: "UNKNOWN",
        confidence: 100,
        signals: { labelText: "Điều khoản" },
        status: "policy_blocked",
      },
      {
        candidateType: "FULL_NAME",
        confidence: 90,
        signals: { labelText: "Tên" },
        status: "ambiguous",
      },
      {
        candidateType: "EMAIL",
        confidence: 60,
        signals: { labelText: "Email phụ" },
        status: "low_confidence",
      },
    ] as DetectedField[];

    showAutofillOverlay(results);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("Skipped: policy");
    expect(text).toContain("Skipped: ambiguous");
    expect(text).toContain("Skipped: low confidence");
    expect(text).not.toContain("○ Not found");
  });

  it("distinguishes a filled confirmation field from a duplicate that needs manual input", () => {
    const results = [
      {
        candidateType: "EMAIL",
        confidence: 100,
        signals: { labelText: "Xác nhận Email" },
        status: "filled",
      },
      {
        candidateType: "FULL_NAME",
        confidence: 100,
        signals: { labelText: "Họ và tên người thứ hai" },
        status: "duplicate_manual",
      },
    ] as DetectedField[];

    showAutofillOverlay(results);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("✓ Matched 100%");
    expect(text).toContain("trùng loại — tự nhập");
  });

  it("warns when a pre-populated value differs from the profile", () => {
    showAutofillOverlay([
      {
        candidateType: "FULL_NAME",
        confidence: 100,
        signals: { labelText: "Họ và tên" },
        status: "prepopulated_mismatch",
      } as DetectedField,
    ]);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("đã điền nhưng khác profile — kiểm tra lại");
  });

  it("marks a pre-populated value that matches the profile as already available", () => {
    showAutofillOverlay([
      {
        candidateType: "FULL_NAME",
        confidence: 100,
        signals: { labelText: "Họ và tên" },
        status: "prepopulated",
      } as DetectedField,
    ]);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("đã có sẵn");
    expect(text).toContain("giá trị đúng profile");
  });

  it("explains when a field's maxlength or pattern rejects the profile format", () => {
    showAutofillOverlay([
      {
        candidateType: "ID_NUMBER",
        confidence: 100,
        signals: { labelText: "Số CMND" },
        status: "format_mismatch",
      } as DetectedField,
    ]);

    const text = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(text).toContain("định dạng không khớp");
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

  it("lets the user correct a match and saves the selected field type", async () => {
    const onFieldCorrection = vi.fn(async () => undefined);
    const field = {
      candidateType: "ID_NUMBER",
      confidence: 91,
      signals: { labelText: "Mã người tham dự" },
      status: "filled",
    } as DetectedField;
    showAutofillOverlay([field], document, {
      onRescan: vi.fn(),
      onRefill: vi.fn(),
      onFieldCorrection,
    });

    const shadow = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
    if (!shadow) throw new Error("Overlay shadow root was not rendered");
    (shadow.querySelector("[data-field-correction='0']") as HTMLButtonElement).click();
    const select = shadow.querySelector<HTMLSelectElement>("[data-correction-type]")!;
    select.value = "FULL_NAME";
    (shadow.querySelector("[data-correction-save]") as HTMLButtonElement).click();

    await vi.waitFor(() => expect(onFieldCorrection).toHaveBeenCalledWith(field, "FULL_NAME"));
    expect(shadow.querySelector("[data-correction-status]")?.textContent).toContain("Đã lưu");
  });
});
