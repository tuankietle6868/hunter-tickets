import type { ControlType, FieldType } from "../shared/types";

/** Field categories whose values are safe to apply automatically. */
export const AUTO_FILL_FIELD_TYPES = [
  "FULL_NAME",
  "ID_NUMBER",
  "PHONE",
  "EMAIL",
  "DATE_OF_BIRTH",
  "PROVINCE",
  "WARD",
  "DISTRICT_LEGACY",
  "GENDER",
] as const satisfies readonly FieldType[];

const AUTO_FILL_FIELD_TYPE_SET = new Set<FieldType>(AUTO_FILL_FIELD_TYPES);

/**
 * Policy is intentionally independent of matcher confidence. A high-confidence
 * match may still be unsafe to populate, such as an agreement checkbox.
 */
export function isAutoFillPermitted(fieldType: FieldType, controlType: ControlType): boolean {
  if (!AUTO_FILL_FIELD_TYPE_SET.has(fieldType)) return false;
  return fieldType !== "GENDER" || controlType === "RADIO";
}
