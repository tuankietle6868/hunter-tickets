import { describe, expect, it } from "vitest";

import { mapAutocompleteToFieldType } from "../src/shared/autocomplete";

describe("mapAutocompleteToFieldType", () => {
  it.each([
    ["name", "FULL_NAME"],
    ["tel", "PHONE"],
    ["email", "EMAIL"],
    ["bday", "DATE_OF_BIRTH"],
  ] as const)("maps autocomplete=%s to %s", (autocomplete, fieldType) => {
    expect(mapAutocompleteToFieldType(autocomplete)).toBe(fieldType);
  });

  it("uses the final token when autocomplete contains a section prefix", () => {
    expect(mapAutocompleteToFieldType("section-registration shipping tel")).toBe("PHONE");
  });

  it("returns UNKNOWN for an unsupported autocomplete value", () => {
    expect(mapAutocompleteToFieldType("organization")).toBe("UNKNOWN");
  });
});
