import type { FieldType } from "./types";

/** Maps HTML autocomplete field-name tokens to supported profile field types. */
export const AUTOCOMPLETE_FIELD_TYPE_MAP: Readonly<Record<string, FieldType>> = {
  name: "FULL_NAME",
  tel: "PHONE",
  "tel-national": "PHONE",
  "tel-country-code": "PHONE",
  "tel-area-code": "PHONE",
  "tel-local": "PHONE",
  email: "EMAIL",
  bday: "DATE_OF_BIRTH",
  sex: "GENDER",
  "street-address": "ADDRESS",
  "address-line1": "ADDRESS",
};

/**
 * Maps an HTML `autocomplete` attribute value to a supported field type.
 * Section, address-kind, and contact-kind prefixes are ignored.
 */
export function mapAutocompleteToFieldType(autocomplete: string): FieldType {
  const fieldName = autocomplete.trim().toLowerCase().split(/\s+/).at(-1);

  return fieldName ? (AUTOCOMPLETE_FIELD_TYPE_MAP[fieldName] ?? "UNKNOWN") : "UNKNOWN";
}
