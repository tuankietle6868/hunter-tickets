import { afterEach, describe, expect, it } from "vitest";

import { MicrosoftFormsAdapter } from "../src/content/adapters/microsoftFormsAdapter";

describe("MicrosoftFormsAdapter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses Microsoft Forms automation IDs to find question blocks and their titles", () => {
    document.body.innerHTML = `
      <main>
        <div data-automation-id="questionItem">
          <div id="QuestionId_name"><span data-automation-id="questionTitle">1. Họ và tên *</span></div>
          <input data-automation-id="textInput" aria-labelledby="QuestionId_name" placeholder="Nhập câu trả lời" />
        </div>
        <div data-automation-id="questionItem">
          <div id="QuestionId_phone"><span data-automation-id="questionTitle">2. Số điện thoại</span></div>
          <input data-automation-id="textInput" type="tel" aria-labelledby="QuestionId_phone" />
        </div>
      </main>
    `;
    const adapter = new MicrosoftFormsAdapter();

    expect(adapter.isApplicable()).toBe(true);
    expect(adapter.findQuestions()).toHaveLength(2);
    expect(adapter.getQuestionText(adapter.findQuestions()[0])).toMatchObject({
      visibleQuestionText: "1. Họ và tên *",
      labelText: "1. Họ và tên *",
      ariaLabelledByText: "1. Họ và tên *",
      placeholder: "Nhập câu trả lời",
    });
  });

  it("notifies controlled text inputs and verifies after their next render", async () => {
    document.body.innerHTML = `
      <div data-automation-id="questionItem">
        <span data-automation-id="questionTitle">Email</span>
        <input data-automation-id="textInput" type="email" />
      </div>
    `;
    const adapter = new MicrosoftFormsAdapter();
    const input = adapter.findInput(adapter.findQuestions()[0]) as HTMLInputElement;
    let committedValue = "";
    input.addEventListener("input", () => {
      committedValue = input.value;
    });
    input.addEventListener("change", () => {
      requestAnimationFrame(() => {
        input.value = committedValue;
      });
    });

    adapter.setValue(input, "an@example.com");

    expect(await adapter.verifyValue(input, "an@example.com")).toBe(true);
  });

  it("selects and verifies a radio option by its visible label", async () => {
    document.body.innerHTML = `
      <div data-automation-id="questionItem">
        <span data-automation-id="questionTitle">Giới tính</span>
        <label><input type="radio" name="gender" value="male" /> Nam</label>
        <label><input type="radio" name="gender" value="female" /> Nữ</label>
      </div>
    `;
    const adapter = new MicrosoftFormsAdapter();
    const firstRadio = adapter.findInput(adapter.findQuestions()[0])!;
    const female = document.querySelector<HTMLInputElement>('input[value="female"]')!;
    female.addEventListener("click", () => {
      female.checked = true;
    });

    adapter.setValue(firstRadio, "Nữ");

    expect(female.checked).toBe(true);
    expect(await adapter.verifyValue(firstRadio, "Nữ")).toBe(true);
  });
});
