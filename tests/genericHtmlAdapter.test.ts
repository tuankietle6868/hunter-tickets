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

  it("groups all radio options in one question into one logical field", () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Giới tính</legend>
        <label><input type="radio" name="gender" value="male" /> Nam</label>
        <label><input type="radio" name="gender" value="female" /> Nữ</label>
        <label><input type="radio" name="gender" value="other" /> Khác</label>
      </fieldset>
    `;
    const adapter = new GenericHtmlAdapter();

    const questions = adapter.findQuestions();

    expect(questions).toHaveLength(1);
    expect(adapter.getQuestionText(questions[0]).visibleQuestionText).toBe("Giới tính");
    expect(adapter.findInput(questions[0])?.getAttribute("value")).toBe("male");
  });

  it("groups a two-option radio question by its shared name", () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Hình thức tham dự</legend>
        <label><input type="radio" name="attendance" value="online" /> Trực tuyến</label>
        <label><input type="radio" name="attendance" value="offline" /> Trực tiếp</label>
      </fieldset>
    `;

    const questions = new GenericHtmlAdapter().findQuestions();

    expect(questions).toHaveLength(1);
    expect(questions[0].getAttribute("name")).toBe("attendance");
  });

  it("verifies the selected radio option by its visible label", () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Giới tính</legend>
        <label><input type="radio" name="gender" value="choice-a" /> Nam</label>
        <label><input type="radio" name="gender" value="choice-b" /> Nữ</label>
      </fieldset>
    `;
    const adapter = new GenericHtmlAdapter();
    const firstRadio = document.querySelector<HTMLInputElement>('input[value="choice-a"]')!;

    adapter.setValue(firstRadio, "Nữ");

    expect(adapter.verifyValue(firstRadio, "Nữ")).toBe(true);
    expect(adapter.verifyValue(firstRadio, "Nam")).toBe(false);
  });

  it("does not merge same-named radio questions from separate forms", () => {
    document.body.innerHTML = `
      <form><fieldset><legend>Giới tính</legend><input type="radio" name="gender" /></fieldset></form>
      <form><fieldset><legend>Giới tính</legend><input type="radio" name="gender" /></fieldset></form>
    `;

    expect(new GenericHtmlAdapter().findQuestions()).toHaveLength(2);
  });

  it("keeps a boolean checkbox separate from a multi-choice checkbox group", () => {
    document.body.innerHTML = `
      <label><input type="checkbox" name="terms" /> Đồng ý điều khoản</label>
      <fieldset>
        <legend>Sở thích</legend>
        <label><input type="checkbox" name="hobby" value="music" /> Âm nhạc</label>
        <label><input type="checkbox" name="hobby" value="sport" /> Thể thao</label>
      </fieldset>
    `;

    const questions = new GenericHtmlAdapter().findQuestions();

    expect(questions).toHaveLength(2);
    expect(questions.map((question) => question.getAttribute("name"))).toEqual(["terms", "hobby"]);
  });
});
