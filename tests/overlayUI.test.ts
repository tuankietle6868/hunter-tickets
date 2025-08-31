import { afterEach, describe, expect, it } from "vitest";

import { OVERLAY_HOST_ID, OVERLAY_PANEL_ID, showAutofillOverlay } from "../src/content/overlayUI";

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
});
