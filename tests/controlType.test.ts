import { afterEach, describe, expect, it } from "vitest";

import {
  classifyControl,
  getNativeCheckboxMode,
  getNativeSelectMode,
} from "../src/content/controlType";

describe("ControlType classification", () => {
  afterEach(() => document.body.replaceChildren());

  it("distinguishes native form control types", () => {
    document.body.innerHTML = `
      <input id="input" type="text" />
      <textarea id="textarea"></textarea>
      <select id="select"><option>Nam</option></select>
      <input id="checkbox" type="checkbox" />
      <input id="radio" type="radio" />
      <input id="date" type="date" />
    `;

    expect(classifyControl(document.querySelector("#input"))).toBe("INPUT");
    expect(classifyControl(document.querySelector("#textarea"))).toBe("TEXTAREA");
    expect(classifyControl(document.querySelector("#select"))).toBe("SELECT");
    expect(classifyControl(document.querySelector("#checkbox"))).toBe("CHECKBOX");
    expect(classifyControl(document.querySelector("#radio"))).toBe("RADIO");
    expect(classifyControl(document.querySelector("#date"))).toBe("DATE_PICKER");
  });

  it("recognises ARIA custom selects, ARIA date pickers, and unknown elements", () => {
    document.body.innerHTML = `
      <button id="custom-select" role="combobox" aria-haspopup="listbox"></button>
      <input id="input-combobox" role="combobox" type="text" />
      <input id="date-combobox" role="combobox" aria-label="Ngày sinh" type="text" />
      <button id="date-dialog" aria-haspopup="dialog" aria-label="Ngày sinh"></button>
      <div id="unknown"></div>
    `;

    expect(classifyControl(document.querySelector("#custom-select"))).toBe("CUSTOM_SELECT");
    expect(classifyControl(document.querySelector("#input-combobox"))).toBe("CUSTOM_SELECT");
    expect(classifyControl(document.querySelector("#date-combobox"))).toBe("DATE_PICKER");
    expect(classifyControl(document.querySelector("#date-dialog"))).toBe("DATE_PICKER");
    expect(classifyControl(document.querySelector("#unknown"))).toBe("UNKNOWN");
  });

  it("detects native single and multiple select modes", () => {
    document.body.innerHTML = `
      <select id="single"><option>Nam</option></select>
      <select id="multiple" multiple><option>Nam</option></select>
    `;

    expect(getNativeSelectMode(document.querySelector("#single"))).toBe("single");
    expect(getNativeSelectMode(document.querySelector("#multiple"))).toBe("multiple");
  });

  it("distinguishes a boolean checkbox from a multi-choice group", () => {
    document.body.innerHTML = `
      <label><input id="boolean" type="checkbox" name="terms" /> Đồng ý điều khoản</label>
      <fieldset>
        <legend>Sở thích</legend>
        <label><input type="checkbox" name="hobby" value="music" /> Âm nhạc</label>
        <label><input id="multiple" type="checkbox" name="hobby" value="sport" /> Thể thao</label>
      </fieldset>
    `;

    expect(getNativeCheckboxMode(document.querySelector("#boolean"))).toBe("boolean");
    expect(getNativeCheckboxMode(document.querySelector("#multiple"))).toBe("multiple");
  });
});
