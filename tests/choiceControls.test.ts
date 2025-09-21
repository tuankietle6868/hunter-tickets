import { afterEach, describe, expect, it } from "vitest";

import {
  fillCustomSelectByText,
  fillMultiCheckboxGroup,
  verifyCustomSelectByText,
  verifyMultiCheckboxGroup,
} from "../src/content/choiceControls";

describe("choice controls", () => {
  afterEach(() => document.body.replaceChildren());

  it("selects every text-matched checkbox only after all requested options resolve", () => {
    document.body.innerHTML = `
      <fieldset><legend>Giới tính</legend>
        <label><input type="checkbox" name="gender" value="male" /> Nam</label>
        <label><input type="checkbox" name="gender" value="female" /> Nữ</label>
        <label><input type="checkbox" name="gender" value="other" /> Khác</label>
      </fieldset>
    `;
    const first = document.querySelector<HTMLInputElement>('input[value="male"]')!;

    expect(fillMultiCheckboxGroup(first, "Nam; Nữ")).toBe(true);
    expect(Array.from(document.querySelectorAll<HTMLInputElement>("input"), (input) => input.checked)).toEqual([
      true,
      true,
      false,
    ]);
    expect(verifyMultiCheckboxGroup(first, "Nam; Nữ")).toBe(true);
  });

  it("does not partially change a checkbox group when one requested option is absent", () => {
    document.body.innerHTML = `
      <fieldset><label><input type="checkbox" name="choice" value="a" /> A</label>
      <label><input type="checkbox" name="choice" value="b" /> B</label></fieldset>
    `;
    const first = document.querySelector<HTMLInputElement>("input")!;

    expect(fillMultiCheckboxGroup(first, "A; C")).toBe(false);
    expect(Array.from(document.querySelectorAll<HTMLInputElement>("input"), (input) => input.checked)).toEqual([
      false,
      false,
    ]);
  });

  it("opens an ARIA combobox and selects an option by canonical text", async () => {
    document.body.innerHTML = `
      <button id="province" type="button" role="combobox" aria-controls="province-options">Chọn tỉnh</button>
      <div id="province-options" role="listbox" hidden>
        <button role="option" data-option-value="01">Hà Nội</button>
        <button role="option" data-option-value="79">Thành phố Hồ Chí Minh</button>
      </div>
    `;
    const control = document.querySelector<HTMLElement>("#province")!;
    const listbox = document.querySelector<HTMLElement>("#province-options")!;
    const hcmOption = listbox.querySelector<HTMLElement>('[data-option-value="79"]')!;
    control.addEventListener("click", () => listbox.removeAttribute("hidden"));
    hcmOption.addEventListener("click", () => {
      hcmOption.setAttribute("aria-selected", "true");
      control.textContent = "Thành phố Hồ Chí Minh";
    });

    expect(await fillCustomSelectByText(control, "TP HCM")).toBe(true);
    expect(verifyCustomSelectByText(control, "TP HCM")).toBe(true);
  });
});
