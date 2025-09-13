import { describe, expect, it } from "vitest";

import {
  AUTO_FILL_FIELD_TYPES,
  isAutoFillPermitted,
  isHardPolicyBlocked,
} from "../src/content/policy";

describe("autofill policy", () => {
  it("contains the shared whitelist of auto-fillable field types", () => {
    expect(AUTO_FILL_FIELD_TYPES).toEqual([
      "FULL_NAME",
      "ID_NUMBER",
      "PHONE",
      "EMAIL",
      "DATE_OF_BIRTH",
      "PROVINCE",
      "WARD",
      "DISTRICT_LEGACY",
      "GENDER",
    ]);
  });

  it("permits whitelisted personal fields but never unknown fields", () => {
    expect(isAutoFillPermitted("FULL_NAME", "INPUT")).toBe(true);
    expect(isAutoFillPermitted("PROVINCE", "SELECT")).toBe(true);
    expect(isAutoFillPermitted("UNKNOWN", "CHECKBOX")).toBe(false);
  });

  it("permits gender only when the control is a radio group", () => {
    expect(isAutoFillPermitted("GENDER", "RADIO")).toBe(true);
    expect(isAutoFillPermitted("GENDER", "INPUT")).toBe(false);
  });

  it.each(["đồng ý", "xác nhận", "cam kết", "điều khoản", "consent", "agree"])(
    "hard-blocks a label containing %s",
    (label) => {
      expect(isHardPolicyBlocked({ labelText: label })).toBe(true);
    },
  );
});
