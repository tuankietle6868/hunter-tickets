import { afterEach, describe, expect, it } from "vitest";

import { GenericHtmlAdapter } from "../src/content/adapters/genericHtmlAdapter";

describe("GenericHtmlAdapter.getQuestionText", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("reads a label associated with the input through for", () => {
    document.body.innerHTML = `
      <label for="phone">Số điện thoại</label>
      <input id="phone" name="phone" type="tel" />
    `;
    const input = document.querySelector<HTMLInputElement>("#phone");

    expect(input).not.toBeNull();
    expect(new GenericHtmlAdapter().getQuestionText(input!)).toMatchObject({
      visibleQuestionText: "Số điện thoại",
      labelText: "Số điện thoại",
      name: "phone",
      inputType: "tel",
    });
  });

  it("reads a label that wraps the input", () => {
    document.body.innerHTML = `
      <label>Họ và tên <input name="fullName" type="text" /></label>
    `;
    const input = document.querySelector<HTMLInputElement>("input");

    expect(input).not.toBeNull();
    expect(new GenericHtmlAdapter().getQuestionText(input!)).toMatchObject({
      visibleQuestionText: "Họ và tên",
      labelText: "Họ và tên",
      name: "fullName",
      inputType: "text",
    });
  });
});
