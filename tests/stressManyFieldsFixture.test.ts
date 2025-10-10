import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { GenericHtmlAdapter } from "../src/content/adapters/genericHtmlAdapter";
import { FULL_FORM_SCAN_MATCH_MAX_DURATION_MS, performanceNow } from "../src/content/performance";
import { scoreField } from "../src/shared/matcher";

describe("stress-many-fields fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("scans and matches 60 fields within the GĐ5 1000ms target", () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/stress-many-fields.html",
      "utf8",
    );
    const adapter = new GenericHtmlAdapter();
    const startedAt = performanceNow();
    const matches = adapter.findQuestions().map((question) => scoreField(adapter.getQuestionText(question)));
    const durationMs = performanceNow() - startedAt;

    expect(matches).toHaveLength(60);
    expect(matches.filter(({ type }) => type !== "UNKNOWN")).toHaveLength(6);
    expect(durationMs).toBeLessThanOrEqual(FULL_FORM_SCAN_MATCH_MAX_DURATION_MS);
  });
});
