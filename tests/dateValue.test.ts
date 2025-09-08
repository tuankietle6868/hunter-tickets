import { afterEach, describe, expect, it } from "vitest";

import { fillBirthYearSelect, fillSeparateDateSelects } from "../src/content/dateValue";

describe("fillSeparateDateSelects", () => {
  afterEach(() => document.body.replaceChildren());

  it("fills independent Ngày, Tháng, and Năm selects from one ISO birthday", () => {
    document.body.innerHTML = `
      <form>
        <label>Ngày <select id="day"><option value="">Ngày</option><option value="7">7</option></select></label>
        <label>Tháng <select id="month"><option value="">Tháng</option><option value="10">10</option></select></label>
        <label>Năm <select id="year"><option value="">Năm</option><option value="1999">1999</option></select></label>
      </form>
    `;
    const changes: string[] = [];
    const day = document.querySelector<HTMLSelectElement>("#day")!;
    const month = document.querySelector<HTMLSelectElement>("#month")!;
    const year = document.querySelector<HTMLSelectElement>("#year")!;
    [day, month, year].forEach((select) =>
      select.addEventListener("change", () => changes.push(select.id)),
    );

    expect(fillSeparateDateSelects("1999-10-07", { day, month, year })).toBe(true);

    expect([day.value, month.value, year.value]).toEqual(["7", "10", "1999"]);
    expect(changes).toEqual(["day", "month", "year"]);
  });

  it("fills a standalone Năm sinh select without requiring Ngày or Tháng fields", () => {
    document.body.innerHTML = `
      <form>
        <label for="birth-year">Năm sinh</label>
        <select id="birth-year"><option value="">Năm</option><option value="1999">1999</option></select>
      </form>
    `;
    const year = document.querySelector<HTMLSelectElement>("#birth-year")!;

    expect(() => fillBirthYearSelect("1999-10-07", year)).not.toThrow();
    expect(year.value).toBe("1999");
  });
});
