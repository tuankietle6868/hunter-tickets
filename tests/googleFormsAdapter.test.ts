import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GoogleFormsAdapter } from "../src/content/adapters/googleFormsAdapter";

const FIXTURE_PATH = resolve(
  process.cwd(),
  "tests/fixtures/google-form-sample.html",
);

describe("GoogleFormsAdapter.findQuestions", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("finds every question block in the surveyed Google Forms fixture", () => {
    document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");

    const questions = new GoogleFormsAdapter().findQuestions();

    expect(questions).toHaveLength(3);
    expect(questions.map((question) => question.dataset.questionKind)).toEqual([
      "short-answer",
      "paragraph",
      "radio",
    ]);
  });
});
