import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { matchProfileToOption } from "../src/content/selectOptions";

describe("address-name-variants fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("matches every Hồ Chí Minh option variant from one profile value", () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/address-name-variants.html",
      "utf8",
    );

    const expectedLabels = new Map([
      ["#province-short", "TP.HCM"],
      ["#province-full", "Thành phố Hồ Chí Minh"],
      ["#province-standard", "Hồ Chí Minh"],
    ]);

    for (const [selector, expectedLabel] of expectedLabels) {
      const select = document.querySelector<HTMLSelectElement>(selector);
      expect(select, selector).not.toBeNull();

      const option = matchProfileToOption(
        "Hồ Chí Minh",
        Array.from(select!.options, (item, index) => ({
          value: item.value,
          text: item.text,
          index,
          selected: item.selected,
          disabled: item.disabled,
        })),
      );

      expect(option?.text, selector).toBe(expectedLabel);
    }
  });
});
