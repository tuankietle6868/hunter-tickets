import { afterEach, describe, expect, it } from "vitest";

import { GoogleFormsAdapter } from "../src/content/adapters/googleFormsAdapter";
import {
  getGoogleFormsAdapterOrShowFallback,
  UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID,
} from "../src/content/googleFormsFallback";

describe("Google Forms unsupported-DOM fallback", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not throw or fill a lookalike DOM, and shows a clear warning", () => {
    document.body.innerHTML = `
      <main class="unrecognised-google-form">
        <label>Họ và tên <input type="text" /></label>
      </main>
    `;
    const input = document.querySelector<HTMLInputElement>("input")!;

    expect(new GoogleFormsAdapter().isApplicable()).toBe(false);
    expect(() => getGoogleFormsAdapterOrShowFallback()).not.toThrow();
    expect(getGoogleFormsAdapterOrShowFallback()).toBeNull();
    expect(input.value).toBe("");

    const overlay = document.getElementById(UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID);
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain("Không nhận diện được cấu trúc Google Forms này");
    expect(overlay?.getAttribute("role")).toBe("alert");
    expect(document.querySelectorAll(`#${UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID}`)).toHaveLength(1);
  });

  it("does not render the automatic warning when overlay is disabled", () => {
    expect(getGoogleFormsAdapterOrShowFallback(false)).toBeNull();
    expect(document.getElementById(UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID)).toBeNull();
  });
});
