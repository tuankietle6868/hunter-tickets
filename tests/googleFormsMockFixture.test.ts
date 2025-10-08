import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GoogleFormsAdapter } from "../src/content/adapters/googleFormsAdapter";

const FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/google-forms-mock.html");

describe("google-forms-mock fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("lets GoogleFormsAdapter scan respondent-view list items entirely in jsdom", () => {
    document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");
    const adapter = new GoogleFormsAdapter();

    expect(adapter.isApplicable()).toBe(true);
    const questions = adapter.findQuestions();
    expect(questions.map((question) => question.dataset.questionId)).toEqual([
      "name",
      "email",
      "note",
    ]);
    expect(questions.map((question) => adapter.findInput(question)?.id)).toEqual([
      "mock-name",
      "mock-email",
      "mock-note",
    ]);
    expect(adapter.getQuestionText(questions[0])).toMatchObject({
      visibleQuestionText: "Họ và tên *",
      ariaLabelledByText: "Họ và tên *",
      surroundingText: "Dùng tên trên giấy tờ tùy thân.",
      inputType: "text",
    });
    expect(adapter.getQuestionText(questions[1])).toMatchObject({
      visibleQuestionText: "Email liên hệ",
      inputType: "email",
    });
  });
});
