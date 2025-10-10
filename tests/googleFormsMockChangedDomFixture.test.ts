import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GoogleFormsAdapter } from "../src/content/adapters/googleFormsAdapter";
import {
  getGoogleFormsAdapterOrShowFallback,
  UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID,
} from "../src/content/googleFormsFallback";

const FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/google-forms-mock-changed-dom.html");

describe("google-forms-mock-changed-dom fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the unsupported-DOM fallback rather than guessing or filling", () => {
    document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");
    const input = document.querySelector<HTMLInputElement>("#changed-name")!;
    const adapter = new GoogleFormsAdapter();

    expect(adapter.isApplicable()).toBe(false);
    expect(adapter.findQuestions()).toEqual([]);
    expect(() => getGoogleFormsAdapterOrShowFallback()).not.toThrow();
    expect(getGoogleFormsAdapterOrShowFallback()).toBeNull();
    expect(input.value).toBe("");
    expect(
      document.getElementById(UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID)?.shadowRoot?.textContent,
    ).toContain("Không nhận diện được Google Forms");
  });
});
