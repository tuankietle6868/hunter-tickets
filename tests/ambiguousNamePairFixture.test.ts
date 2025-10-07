import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { runGenericAutofill } from "../src/content/pipeline";

describe("ambiguous-name-pair fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("requires manual review for both equally plausible FULL_NAME candidates", async () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/ambiguous-name-pair.html",
      "utf8",
    );

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    expect(document.querySelector<HTMLInputElement>("#name")?.value).toBe("");
    expect(document.querySelector<HTMLInputElement>("#contact-name")?.value).toBe("");
    expect(results.map(({ candidateType, status }) => ({ candidateType, status }))).toEqual([
      { candidateType: "FULL_NAME", status: "ambiguous" },
      { candidateType: "FULL_NAME", status: "ambiguous" },
    ]);
  });
});
