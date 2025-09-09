import { afterEach, describe, expect, it } from "vitest";

import {
  fillBirthYearSelect,
  fillSeparateDateSelects,
  formatValueForInput,
} from "../src/content/dateValue";
import { setNativeValue } from "../src/content/filler";
import {
  verifyBirthYearSelect,
  verifySeparateDateSelects,
  verifyValue,
} from "../src/content/validator";

describe("date field verification", () => {
  afterEach(() => document.body.replaceChildren());

  it("verifies a native date input by its canonical ISO value", () => {
    const input = document.createElement("input");
    input.type = "date";
    setNativeValue(input, "2000-05-12");

    expect(verifyValue(input, "12/05/2000")).toBe(true);
  });

  it("verifies independent Ngày/Tháng/Năm selects by their canonical date", () => {
    document.body.innerHTML = `
      <select id="day"><option value="12">12</option></select>
      <select id="month"><option value="5">5</option></select>
      <select id="year"><option value="2000">2000</option></select>
    `;
    const day = document.querySelector<HTMLSelectElement>("#day")!;
    const month = document.querySelector<HTMLSelectElement>("#month")!;
    const year = document.querySelector<HTMLSelectElement>("#year")!;
    fillSeparateDateSelects("2000-05-12", { day, month, year });

    expect(verifySeparateDateSelects({ day, month, year }, "12/05/2000")).toBe(true);
  });

  it("verifies a standalone Năm sinh select without day or month fields", () => {
    const year = document.createElement("select");
    year.innerHTML = '<option value="2000">2000</option>';
    fillBirthYearSelect("2000-05-12", year);

    expect(verifyBirthYearSelect(year, "12/05/2000")).toBe(true);
  });

  it.each(["dd/mm/yyyy", "dd-mm-yyyy", "yyyy-mm-dd"])(
    "verifies a %s free-text date against canonical ISO",
    (placeholder) => {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = placeholder;
      setNativeValue(input, formatValueForInput("2000-05-12", "DATE_OF_BIRTH", input));

      expect(verifyValue(input, "2000-05-12")).toBe(true);
    },
  );
});
