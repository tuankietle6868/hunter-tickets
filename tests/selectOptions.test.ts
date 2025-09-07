import { afterEach, describe, expect, it } from "vitest";

import { extractOptions, matchProfileToOption } from "../src/content/selectOptions";

describe("extractOptions", () => {
  afterEach(() => document.body.replaceChildren());

  it("extracts value, visible text, index, and selection from a single select", () => {
    document.body.innerHTML = `
      <select id="gender">
        <option value="" disabled> Chọn giới tính </option>
        <option value="male" selected> Nam </option>
        <option value="female">Nữ</option>
      </select>
    `;

    expect(extractOptions(document.querySelector<HTMLSelectElement>("#gender")!)).toEqual([
      { value: "", text: "Chọn giới tính", index: 0, selected: false, disabled: true },
      { value: "male", text: "Nam", index: 1, selected: true, disabled: false },
      { value: "female", text: "Nữ", index: 2, selected: false, disabled: false },
    ]);
  });

  it("preserves every selected option in a multiple select", () => {
    document.body.innerHTML = `
      <select id="interests" multiple>
        <optgroup label="Sở thích">
          <option value="music" selected>Âm nhạc</option>
          <option value="sport">Thể thao</option>
          <option value="travel" selected>Du lịch</option>
        </optgroup>
      </select>
    `;

    expect(extractOptions(document.querySelector<HTMLSelectElement>("#interests")!)).toEqual([
      { value: "music", text: "Âm nhạc", index: 0, selected: true, disabled: false },
      { value: "sport", text: "Thể thao", index: 1, selected: false, disabled: false },
      { value: "travel", text: "Du lịch", index: 2, selected: true, disabled: false },
    ]);
  });

  it("matches a profile value to an option by normalized visible text", () => {
    const options = [
      { value: "year-1999", text: " 1999 ", index: 0, selected: false, disabled: false },
      { value: "year-2000", text: "2000", index: 1, selected: false, disabled: false },
      { value: "female", text: "Nữ", index: 2, selected: false, disabled: false },
    ];

    expect(matchProfileToOption("2000", options)).toEqual(options[1]);
    expect(matchProfileToOption(" nu ", options)).toEqual(options[2]);
    expect(matchProfileToOption("200", options)).toBeUndefined();
  });

  it("falls back to a normalized option value when its text differs", () => {
    const options = [
      { value: "01", text: "Hà Nội", index: 0, selected: false, disabled: false },
      { value: "79", text: "Hồ Chí Minh", index: 1, selected: false, disabled: false },
    ];

    expect(matchProfileToOption("79", options)).toEqual(options[1]);
    expect(matchProfileToOption("Hồ Chí Minh", options)).toEqual(options[1]);
  });

  it("matches known option aliases through a canonical form", () => {
    const option = {
      value: "hcm-city",
      text: "Thành phố Hồ Chí Minh",
      index: 0,
      selected: false,
      disabled: false,
    };

    expect(matchProfileToOption("TP HCM", [option])).toEqual(option);
    expect(matchProfileToOption("TP. Hồ Chí Minh", [option])).toEqual(option);
  });

  it("does not match disabled or placeholder options", () => {
    const options = [
      { value: "", text: "-- Chọn --", index: 0, selected: true, disabled: false },
      { value: "79", text: "Hồ Chí Minh", index: 1, selected: false, disabled: true },
      { value: "01", text: "Hà Nội", index: 2, selected: false, disabled: false },
    ];

    expect(matchProfileToOption("-- Chọn --", options)).toBeUndefined();
    expect(matchProfileToOption("79", options)).toBeUndefined();
    expect(matchProfileToOption("01", options)).toEqual(options[2]);
  });
});
