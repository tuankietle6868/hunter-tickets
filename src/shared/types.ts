/** A normalized category of personal data that can be matched to a form field. */
export type FieldType =
  | "FULL_NAME"
  | "ID_NUMBER"
  | "PHONE"
  | "EMAIL"
  | "DATE_OF_BIRTH"
  | "ADDRESS"
  | "UNKNOWN";

/** Personal data stored locally and used to populate detected form fields. */
export interface Profile {
  fullName?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  /** ISO 8601 calendar date (`yyyy-mm-dd`). */
  dateOfBirth?: string;
  address?: string;
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
  signals: FieldSignals;
  candidateType: FieldType;
  /** Match confidence on a 0–100 scale. */
  confidence: number;
  status: "pending" | "filled" | "skipped" | "verify_failed";
}
