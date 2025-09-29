import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { runGenericAutofill } from "../src/content/pipeline";

describe("checkbox-consent fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("never ticks consent checkboxes, even after autofill runs twice", async () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/checkbox-consent.html",
      "utf8",
    );
    const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    const profile = {
      fullName: "Nguyễn Văn An",
      idNumber: "001200000001",
      phone: "0901234567",
      email: "an@example.com",
      dateOfBirth: "2000-05-12",
      address: "1 Đường Mẫu",
      gender: "Nam",
    };
    const firstRun = await runGenericAutofill(profile);
    const secondRun = await runGenericAutofill(profile);

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((checkbox) => !checkbox.checked)).toBe(true);
    expect(firstRun.map((field) => field.status)).toEqual(["policy_blocked", "policy_blocked"]);
    expect(secondRun.map((field) => field.status)).toEqual(["policy_blocked", "policy_blocked"]);
  });
});
