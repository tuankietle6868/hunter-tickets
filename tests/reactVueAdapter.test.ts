import { afterEach, describe, expect, it } from "vitest";

import { ReactVueAdapter } from "../src/content/adapters/reactVueAdapter";

describe("ReactVueAdapter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses ARIA references and a semantic field container instead of generated classes", () => {
    document.body.innerHTML = `
      <div data-v-app>
        <div data-form-field class="v-1b2c3d">
          <span id="email-label" data-field-label>Email liên hệ *</span>
          <span id="email-help">Dùng email đang hoạt động.</span>
          <input type="email" aria-labelledby="email-label" aria-describedby="email-help" />
        </div>
      </div>
    `;
    const adapter = new ReactVueAdapter();
    const question = adapter.findQuestions()[0];

    expect(adapter.getQuestionText(question)).toMatchObject({
      visibleQuestionText: "Email liên hệ *",
      labelText: "Email liên hệ *",
      ariaLabelledByText: "Email liên hệ *",
      surroundingText: "Dùng email đang hoạt động.",
    });
  });

  it("waits for a controlled React-style input to commit its value", async () => {
    document.body.innerHTML = `
      <div id="root">
        <label>Email <input type="email" /></label>
      </div>
    `;
    const adapter = new ReactVueAdapter();
    const input = document.querySelector<HTMLInputElement>("input")!;
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

  it("keeps the native radio handling supplied by GenericHtmlAdapter", async () => {
    document.body.innerHTML = `
      <div data-reactroot><fieldset><legend>Giới tính</legend>
        <label><input type="radio" name="gender" value="male" /> Nam</label>
        <label><input type="radio" name="gender" value="female" /> Nữ</label>
      </fieldset></div>
    `;
    const adapter = new ReactVueAdapter();
    const firstRadio = adapter.findQuestions()[0];

    adapter.setValue(firstRadio, "Nữ");

    expect(await adapter.verifyValue(firstRadio, "Nữ")).toBe(true);
  });
});
