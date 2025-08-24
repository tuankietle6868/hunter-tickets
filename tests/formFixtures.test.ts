import { describe, expect, it } from "vitest";

import { scoreField } from "../src/shared/matcher";
import { FORM_FIXTURES } from "./fixtures/forms";

describe("Form A/B/C matching fixtures", () => {
  for (const form of FORM_FIXTURES) {
    it(`${form.name} matches every field with confidence at least 80`, () => {
      for (const field of form.fields) {
        const result = scoreField(field.signals);

        expect(result.type, field.description).toBe(field.expectedType);
        expect(result.confidence, field.description).toBeGreaterThanOrEqual(80);
      }
    });
  }
});
