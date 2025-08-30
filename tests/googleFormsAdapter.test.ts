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

  it("uses the question heading as matching text and keeps help text separate", () => {
    document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");
    const adapter = new GoogleFormsAdapter();
    const [shortAnswer, paragraph] = adapter.findQuestions();

    expect(adapter.getQuestionText(shortAnswer)).toMatchObject({
      visibleQuestionText: "Họ và tên *",
      labelText: "Họ và tên *",
      ariaLabelledByText: "Họ và tên *",
      surroundingText: "Nhập đúng như trên giấy tờ.",
      inputType: "text",
    });
    expect(adapter.getQuestionText(shortAnswer).visibleQuestionText).not.toContain(
      "Nhập đúng như trên giấy tờ.",
    );

    expect(adapter.getQuestionText(paragraph)).toMatchObject({
      visibleQuestionText: "Địa chỉ liên hệ",
      surroundingText: "Số nhà, đường, phường/xã, tỉnh/thành.",
      inputType: "textarea",
    });
  });

  it("finds the native text control belonging to each supported question", () => {
    document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");
    const adapter = new GoogleFormsAdapter();
    const [shortAnswer, paragraph, radio] = adapter.findQuestions();

    const shortAnswerInput = adapter.findInput(shortAnswer);
    const paragraphInput = adapter.findInput(paragraph);

    expect(shortAnswerInput).toBeInstanceOf(HTMLInputElement);
    expect(shortAnswerInput?.closest('[role="listitem"]')).toBe(shortAnswer);
    expect(paragraphInput).toBeInstanceOf(HTMLTextAreaElement);
    expect(paragraphInput?.closest('[role="listitem"]')).toBe(paragraph);
    expect(adapter.findInput(radio)).toBeNull();
  });

  it("notifies a Forms-like controlled input so its value survives a render", async () => {
    document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");
    const adapter = new GoogleFormsAdapter();
    const input = adapter.findInput(adapter.findQuestions()[0]) as HTMLInputElement;
    let controlledValue = "";
    let receivedInputEvent: Event | undefined;

    input.addEventListener("input", (event) => {
      receivedInputEvent = event;
      controlledValue = input.value;
    });
    input.addEventListener("change", () => {
      requestAnimationFrame(() => {
        input.value = controlledValue;
      });
    });

    adapter.setValue(input, "Nguyễn Văn A");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(receivedInputEvent).toBeInstanceOf(InputEvent);
    expect(input.value).toBe("Nguyễn Văn A");
    expect(adapter.verifyValue(input, "Nguyễn Văn A")).toBe(true);
  });
});
