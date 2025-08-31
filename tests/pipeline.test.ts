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
});
