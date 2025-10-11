import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("fills both primary and confirmation Email/SĐT fields with the same profile values", async () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Email</label><input id="email" type="email" />
        <label for="email-confirm">Xác nhận Email</label><input id="email-confirm" type="email" />
        <label for="phone">SĐT</label><input id="phone" type="tel" />
        <label for="phone-confirm">Nhập lại SĐT</label><input id="phone-confirm" type="tel" />
      </form>
    `;

    const results = await runGenericAutofill({
      email: "an@example.com",
      phone: "0901234567",
    });

    expect((document.querySelector("#email") as HTMLInputElement).value).toBe("an@example.com");
    expect((document.querySelector("#email-confirm") as HTMLInputElement).value).toBe(
      "an@example.com",
    );
    expect((document.querySelector("#phone") as HTMLInputElement).value).toBe("0901234567");
    expect((document.querySelector("#phone-confirm") as HTMLInputElement).value).toBe("0901234567");
    expect(results.map(({ status }) => status)).toEqual(["filled", "filled", "filled", "filled"]);
  });

  it("fills only the first non-confirmation duplicate field type", async () => {
    document.body.innerHTML = `
      <form>
        <label for="attendee-one">Họ và tên</label><input id="attendee-one" type="text" />
        <label for="attendee-two">Họ và tên</label><input id="attendee-two" type="text" />
      </form>
    `;

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    expect((document.querySelector("#attendee-one") as HTMLInputElement).value).toBe("Nguyễn Văn An");
    expect((document.querySelector("#attendee-two") as HTMLInputElement).value).toBe("");
    expect(results.map(({ status }) => status)).toEqual(["filled", "duplicate_manual"]);
  });

  it("verifies a phone value after an input mask adds separators", async () => {
    document.body.innerHTML = `
      <form><label>SĐT <input id="phone" type="tel" /></label></form>
    `;
    const input = document.querySelector<HTMLInputElement>("#phone")!;
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 10);
      input.value = digits.replace(/(\d{3})(\d{3})(\d{0,4})/, (_match, first, second, third) =>
        third ? `${first}-${second}-${third}` : `${first}-${second}`,
      );
    });

    const results = await runGenericAutofill({ phone: "0901234567" });

    expect(input.value).toBe("090-123-4567");
    expect(results[0].status).toBe("filled");
  });

  it("keeps an existing value that already matches the profile", async () => {
    document.body.innerHTML = `
      <form><label>Họ và tên <input id="full-name" value="Nguyễn Văn An" /></label></form>
    `;

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    expect((document.querySelector("#full-name") as HTMLInputElement).value).toBe("Nguyễn Văn An");
    expect(results[0].status).toBe("prepopulated");
  });

  it("does not overwrite an existing value that differs from the profile", async () => {
    document.body.innerHTML = `
      <form><label>Họ và tên <input id="full-name" value="Trần Thị Bình" /></label></form>
    `;

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    expect((document.querySelector("#full-name") as HTMLInputElement).value).toBe("Trần Thị Bình");
    expect(results[0].status).toBe("prepopulated_mismatch");
  });

  it("does not truncate a 12-digit CCCD to fit a legacy 9-character CMND field", async () => {
    document.body.innerHTML = `
      <form><label>Số CCCD <input id="identity" type="text" maxlength="9" /></label></form>
    `;

    const results = await runGenericAutofill({ idNumber: "012345678901" });

    expect((document.querySelector("#identity") as HTMLInputElement).value).toBe("");
    expect(results[0].status).toBe("format_mismatch");
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

  it("fills every native DOB variant without treating separate selects as a cascade", async () => {
    document.body.innerHTML = `
      <form>
        <label>Ngày sinh <input id="native" type="date" /></label>
        <fieldset><legend>Ngày sinh</legend>
          <select id="day" name="birth-day"><option value="12">12</option></select>
          <select id="month" name="birth-month"><option value="5">5</option></select>
          <select id="year" name="birth-year"><option value="2000">2000</option></select>
        </fieldset>
        <label>Năm sinh <select id="standalone-year" name="standalone-birth-year"><option value="2000">2000</option></select></label>
        <label>Ngày sinh <input id="text-date" type="text" placeholder="dd/mm/yyyy" /></label>
      </form>
    `;

    await runGenericAutofill({ dateOfBirth: "2000-05-12" });

    expect((document.querySelector("#native") as HTMLInputElement).value).toBe("2000-05-12");
    expect((document.querySelector("#day") as HTMLSelectElement).value).toBe("12");
    expect((document.querySelector("#month") as HTMLSelectElement).value).toBe("5");
    expect((document.querySelector("#year") as HTMLSelectElement).value).toBe("2000");
    expect((document.querySelector("#standalone-year") as HTMLSelectElement).value).toBe("2000");
    expect((document.querySelector("#text-date") as HTMLInputElement).value).toBe("12/05/2000");
  });

  it("never auto-ticks a terms checkbox, regardless of matching confidence", async () => {
    document.body.innerHTML = `
      <form>
        <label>Tôi đồng ý điều khoản <input id="terms" type="checkbox" name="terms" /></label>
      </form>
    `;

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    expect((document.querySelector("#terms") as HTMLInputElement).checked).toBe(false);
    expect(results).toMatchObject([{ status: "policy_blocked" }]);
  });

  it("fills an address text area instead of treating it as a policy-controlled choice", async () => {
    document.body.innerHTML = `
      <form><label>Địa chỉ <textarea id="address" name="address"></textarea></label></form>
    `;

    const results = await runGenericAutofill({ address: "12 Nguyễn Huệ, Quận 1" });

    expect((document.querySelector("#address") as HTMLTextAreaElement).value).toBe(
      "12 Nguyễn Huệ, Quận 1",
    );
    expect(results).toMatchObject([{ candidateType: "ADDRESS", status: "filled" }]);
  });

  it("fills and verifies a valid field below the fold without scrolling it", async () => {
    document.body.innerHTML = `
      <form><label>Họ và tên <input id="full-name" type="text" /></label></form>
    `;
    const input = document.querySelector<HTMLInputElement>("#full-name")!;
    const scrollIntoView = vi.fn();
    input.scrollIntoView = scrollIntoView;
    Object.defineProperty(input, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: window.innerHeight + 100,
        right: 200,
        bottom: window.innerHeight + 124,
        left: 0,
        width: 200,
        height: 24,
      }),
    });

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });

    expect(input.value).toBe("Nguyễn Văn An");
    expect(results[0].status).toBe("filled");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("verifies the replacement node after a React-like field re-render", async () => {
    document.body.innerHTML = `
      <form id="form"><label>Họ và tên <input id="full-name" name="fullName" type="text" /></label></form>
    `;
    const form = document.querySelector<HTMLFormElement>("#form")!;
    const original = document.querySelector<HTMLInputElement>("#full-name")!;
    original.addEventListener("input", () => {
      const replacement = original.cloneNode() as HTMLInputElement;
      replacement.value = "Nguyễn Văn An";
      original.value = "";
      original.closest("label")?.replaceChildren("Họ và tên ", replacement);
    });

    const results = await runGenericAutofill({ fullName: "Nguyễn Văn An" });
    const current = form.querySelector<HTMLInputElement>("#full-name")!;

    expect(current).not.toBe(original);
    expect(current.value).toBe("Nguyễn Văn An");
    expect(results[0].status).toBe("filled");
    expect(results[0].elementRef.deref()).toBe(current);
  });

  it("fills gender only for a standard radio group, as required by policy", async () => {
    document.body.innerHTML = `
      <form>
        <label for="gender-text">Giới tính</label>
        <input id="gender-text" type="text" />
        <fieldset>
          <legend>Giới tính</legend>
          <label><input id="gender-male" type="radio" name="gender" value="choice-a" /> Nam</label>
          <label><input id="gender-female" type="radio" name="gender" value="choice-b" /> Nữ</label>
          <label><input id="gender-other" type="radio" name="gender" value="choice-c" /> Khác</label>
        </fieldset>
      </form>
    `;

    const results = await runGenericAutofill({ gender: "Nữ" });

    expect((document.querySelector("#gender-text") as HTMLInputElement).value).toBe("");
    expect((document.querySelector("#gender-female") as HTMLInputElement).checked).toBe(true);
    expect(results.map(({ candidateType, status }) => ({ candidateType, status }))).toEqual([
      { candidateType: "GENDER", status: "policy_blocked" },
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

  it("fills a text-matched generic combobox without treating it as a text input", async () => {
    document.body.innerHTML = `
      <form>
        <label for="gender-combobox">Giới tính</label>
        <button id="gender-combobox" type="button" role="combobox" aria-controls="gender-options">Chọn giới tính</button>
        <div id="gender-options" role="listbox" hidden>
          <button role="option">Nam</button><button role="option">Nữ</button>
        </div>
      </form>
    `;
    const control = document.querySelector<HTMLElement>("#gender-combobox")!;
    const listbox = document.querySelector<HTMLElement>("#gender-options")!;
    const form = document.querySelector<HTMLFormElement>("form")!;
    let didSubmit = false;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      didSubmit = true;
    });
    const female = Array.from(listbox.querySelectorAll<HTMLElement>("[role='option']")).find(
      (option) => option.textContent === "Nữ",
    )!;
    control.addEventListener("click", () => listbox.removeAttribute("hidden"));
    female.addEventListener("click", () => {
      female.setAttribute("aria-selected", "true");
      control.textContent = "Nữ";
    });

    const results = await runGenericAutofill({ gender: "Nữ" });

    expect(results[0]).toMatchObject({ candidateType: "GENDER", status: "filled" });
    expect(control.textContent).toBe("Nữ");
    expect(didSubmit).toBe(false);
  });

  it("fills all selected values of a multi-checkbox group while terms remain blocked", async () => {
    document.body.innerHTML = `
      <form>
        <fieldset><legend>Giới tính</legend>
          <label><input type="checkbox" name="gender" value="male" /> Nam</label>
          <label><input type="checkbox" name="gender" value="female" /> Nữ</label>
        </fieldset>
        <label>Đồng ý điều khoản <input type="checkbox" name="terms" /></label>
      </form>
    `;

    const results = await runGenericAutofill({ gender: "Nam; Nữ" });

    expect(Array.from(document.querySelectorAll<HTMLInputElement>('[name="gender"]'), (input) => input.checked)).toEqual([
      true,
      true,
    ]);
    expect(document.querySelector<HTMLInputElement>("[name='terms']")?.checked).toBe(false);
    expect(results.map(({ candidateType, status }) => ({ candidateType, status }))).toEqual([
      { candidateType: "GENDER", status: "filled" },
      { candidateType: "UNKNOWN", status: "policy_blocked" },
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

  it("scans native and custom date picker controls", async () => {
    document.body.innerHTML = `
      <form>
        <label for="native-date">Ngày sinh</label>
        <input id="native-date" type="date" />
        <button id="custom-date" type="button" aria-haspopup="dialog" aria-label="Ngày tháng năm sinh"></button>
        <div id="role-date" role="datepicker" aria-label="Ngày sinh"></div>
      </form>
    `;

    const results = await runGenericAutofill({});

    expect(results.map(({ controlType }) => controlType)).toEqual([
      "DATE_PICKER",
      "DATE_PICKER",
      "DATE_PICKER",
    ]);
  });
});
