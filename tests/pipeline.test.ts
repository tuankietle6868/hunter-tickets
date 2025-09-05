import { afterEach, describe, expect, it } from "vitest";

import { runGenericAutofill } from "../src/content/pipeline";

describe("generic autofill pipeline", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("scans, matches, fills, and verifies a standard HTML form", async () => {
    document.body.innerHTML = `
      <form>
        <label for="full-name">Họ và tên</label>
        <input id="full-name" type="text" />
        <label>Email liên hệ <input type="email" /></label>
        <label for="unknown">Mã giới thiệu</label>
        <input id="unknown" type="text" />
      </form>
    `;

    const results = await runGenericAutofill({
      fullName: "Nguyễn Văn An",
      email: "an@example.com",
    });
    const inputs = document.querySelectorAll<HTMLInputElement>("input");

    expect(inputs[0].value).toBe("Nguyễn Văn An");
    expect(inputs[1].value).toBe("an@example.com");
    expect(inputs[2].value).toBe("");
    expect(results.map(({ candidateType, status }) => ({ candidateType, status }))).toEqual([
      { candidateType: "FULL_NAME", status: "filled" },
      { candidateType: "EMAIL", status: "filled" },
      { candidateType: "UNKNOWN", status: "skipped" },
    ]);
    expect(results.map(({ controlType }) => controlType)).toEqual(["INPUT", "INPUT", "INPUT"]);
  });

  it("fills native and text date fields with the format each control accepts", async () => {
    document.body.innerHTML = `
      <form>
        <label for="native-date">Ngày tháng năm sinh</label>
        <input id="native-date" type="date" />
        <label for="text-date">Ngày sinh</label>
        <input id="text-date" type="text" placeholder="dd/mm/yyyy" />
      </form>
    `;

    const results = await runGenericAutofill({ dateOfBirth: "1999-10-20" });

    expect((document.querySelector("#native-date") as HTMLInputElement).value).toBe("1999-10-20");
    expect((document.querySelector("#text-date") as HTMLInputElement).value).toBe("20/10/1999");
    expect(results.map(({ status }) => status)).toEqual(["filled", "filled"]);
  });

  it("fills gender fields presented as text or a standard radio group", async () => {
    document.body.innerHTML = `
      <form>
        <label for="gender-text">Giới tính</label>
        <input id="gender-text" type="text" />
        <fieldset>
          <legend>Giới tính</legend>
          <label><input type="radio" name="gender" value="male" /> Nam</label>
          <label><input type="radio" name="gender" value="female" /> Nữ</label>
          <label><input type="radio" name="gender" value="other" /> Khác</label>
        </fieldset>
      </form>
    `;

    const results = await runGenericAutofill({ gender: "Nữ" });

    expect((document.querySelector("#gender-text") as HTMLInputElement).value).toBe("Nữ");
    expect((document.querySelector('[value="female"]') as HTMLInputElement).checked).toBe(true);
    expect(results.map(({ candidateType, status }) => ({ candidateType, status }))).toEqual([
      { candidateType: "GENDER", status: "filled" },
      { candidateType: "GENDER", status: "filled" },
    ]);
  });

  it("scans native single and multiple select controls with their mode", async () => {
    document.body.innerHTML = `
      <form>
        <label for="gender-single">Giới tính</label>
        <select id="gender-single"><option>Nam</option></select>
        <label for="gender-multiple">Giới tính</label>
        <select id="gender-multiple" multiple><option>Nam</option><option>Nữ</option></select>
      </form>
    `;

    const results = await runGenericAutofill({});

    expect(results.map(({ controlType, selectMode }) => ({ controlType, selectMode }))).toEqual([
      { controlType: "SELECT", selectMode: "single" },
      { controlType: "SELECT", selectMode: "multiple" },
    ]);
  });

  it("scans ARIA comboboxes and listbox buttons as custom selects", async () => {
    document.body.innerHTML = `
      <form>
        <label for="gender-combobox">Giới tính</label>
        <input id="gender-combobox" role="combobox" aria-expanded="false" type="text" />
        <label for="gender-button">Giới tính</label>
        <button id="gender-button" type="button" aria-haspopup="listbox">Chọn giới tính</button>
      </form>
    `;

    const results = await runGenericAutofill({});

    expect(results.map(({ controlType }) => controlType)).toEqual([
      "CUSTOM_SELECT",
      "CUSTOM_SELECT",
    ]);
  });

  it("reports boolean and multi-choice checkbox modes", async () => {
    document.body.innerHTML = `
      <form>
        <label><input type="checkbox" name="terms" /> Đồng ý điều khoản</label>
        <fieldset><legend>Sở thích</legend>
          <label><input type="checkbox" name="hobby" value="music" /> Âm nhạc</label>
          <label><input type="checkbox" name="hobby" value="sport" /> Thể thao</label>
        </fieldset>
      </form>
    `;

    const results = await runGenericAutofill({});

    expect(results.map(({ controlType, checkboxMode }) => ({ controlType, checkboxMode }))).toEqual(
      [
        { controlType: "CHECKBOX", checkboxMode: "boolean" },
        { controlType: "CHECKBOX", checkboxMode: "multiple" },
      ],
    );
  });
});
