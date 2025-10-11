import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { runGenericAutofill } from "../src/content/pipeline";
import type { DetectedField, FieldType } from "../src/shared/types";

type ExpectedFixture = {
  fixture: string;
  fields: Array<{
    field: string;
    expectedType: FieldType;
    shouldFill: boolean;
    expectedReason?: DetectedField["status"];
  }>;
};

function installProvinceWardCascade(): void {
  const province = document.querySelector<HTMLSelectElement>("#province")!;
  const ward = document.querySelector<HTMLSelectElement>("#ward")!;
  const wardsByProvince: Record<string, Array<[string, string]>> = {
    "79": [["26734", "Phường Bến Nghé"], ["26740", "Phường Bến Thành"]],
    "01": [["00004", "Phường Hoàn Kiếm"]],
  };
  province.addEventListener("change", () => {
    const wards = wardsByProvince[province.value] ?? [];
    ward.replaceChildren(new Option("-- Chọn phường/xã --", ""));
    wards.forEach(([value, text]) => ward.add(new Option(text, value)));
    ward.disabled = wards.length === 0;
  });
}

describe("realistic-combined fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("runs the full pipeline and satisfies its complete expected.json contract", async () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/realistic-combined.html",
      "utf8",
    );
    // Scripts are not executed when fixture HTML is assigned in JSDOM; this
    // listener is intentionally identical to the fixture's native cascade.
    installProvinceWardCascade();
    const expected = JSON.parse(
      readFileSync("public/manual-test/realistic-combined.expected.json", "utf8"),
    ) as ExpectedFixture;

    expect(expected.fixture).toBe("realistic-combined.html");
    const results = await runGenericAutofill({
      fullName: "Nguyễn Văn An",
      idNumber: "079200012345",
      phone: "0901234567",
      email: "an@example.com",
      dateOfBirth: "2000-05-12",
      province: "Hồ Chí Minh",
      ward: "Phường Bến Nghé",
      gender: "Nam",
    });

    for (const field of expected.fields) {
      const element = document.querySelector<HTMLElement>(field.field)!;
      const result = results.find((candidate) => candidate.elementRef.deref() === element);
      if (!field.shouldFill && field.expectedReason === "skipped") {
        expect(result, field.field).toBeUndefined();
        continue;
      }
      expect(result, field.field).toBeDefined();
      expect(result!.candidateType, field.field).toBe(field.expectedType);
      expect(result!.status, field.field).toBe(field.shouldFill ? "filled" : field.expectedReason);
    }

    expect(document.querySelector<HTMLSelectElement>("#province")?.value).toBe("79");
    expect(document.querySelector<HTMLSelectElement>("#ward")?.value).toBe("26734");
    expect(document.querySelector<HTMLInputElement>("#gender-male")?.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#agree-terms")?.checked).toBe(false);
    expect(document.querySelector<HTMLInputElement>("#contact-phone-confirm")?.value).toBe("");
  });
});
