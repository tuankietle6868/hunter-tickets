/** A normalized category of personal data that can be matched to a form field. */
export type FieldType =
  | "FULL_NAME"
  | "ID_NUMBER"
  | "PHONE"
  | "EMAIL"
  | "DATE_OF_BIRTH"
  | "ADDRESS"
  | "GENDER"
  | "PROVINCE"
  | "WARD"
  | "DISTRICT_LEGACY"
  | "COMPANY_NAME"
  | "UNKNOWN";

/** The DOM control category used to select safe fill and verify strategies. */
export type ControlType =
  | "INPUT"
  | "TEXTAREA"
  | "SELECT"
  | "CHECKBOX"
  | "RADIO"
  | "CUSTOM_SELECT"
  | "DATE_PICKER"
  | "UNKNOWN";

/** Native select mode, present only when `controlType` is `SELECT`. */
export type SelectMode = "single" | "multiple";

/** Checkbox interaction mode, present only when `controlType` is `CHECKBOX`. */
export type CheckboxMode = "boolean" | "multiple";

/** Personal data stored locally and used to populate detected form fields. */
export interface Profile {
  fullName?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  /** ISO 8601 calendar date (`yyyy-mm-dd`). */
  dateOfBirth?: string;
  address?: string;
  gender?: string;
  province?: string;
  ward?: string;
  districtLegacy?: string;
}

/** Textual and semantic hints collected from a form field and its context. */
export interface FieldSignals {
  visibleQuestionText?: string;
  labelText?: string;
  ariaLabel?: string;
  ariaLabelledByText?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  surroundingText?: string;
  inputType?: string;
}

/** A scanned field, its inferred type, and the result of a fill attempt. */
export interface DetectedField {
  elementRef: WeakRef<HTMLElement>;
  controlType: ControlType;
  selectMode?: SelectMode;
  checkboxMode?: CheckboxMode;
  signals: FieldSignals;
  candidateType: FieldType;
  /** Match confidence on a 0–100 scale. */
  confidence: number;
  status:
    | "pending"
    | "filled"
    | "skipped"
    | "verify_failed"
    | "cascade_timeout"
    | "policy_blocked"
    | "ambiguous"
    | "low_confidence";
}
