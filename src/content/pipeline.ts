import { scoreField } from "../shared/matcher";
import type { DetectedField, FieldType, Profile } from "../shared/types";
import { GenericHtmlAdapter } from "./adapters/genericHtmlAdapter";

/** Minimum matching confidence required for automatic filling. */
export const AUTO_FILL_CONFIDENCE = 80;

const PROFILE_KEY_BY_FIELD_TYPE: Partial<Record<FieldType, keyof Profile>> = {
  FULL_NAME: "fullName",
  ID_NUMBER: "idNumber",
  PHONE: "phone",
  EMAIL: "email",
  DATE_OF_BIRTH: "dateOfBirth",
  ADDRESS: "address",
};

function getProfileValue(profile: Profile, fieldType: FieldType): string | undefined {
  const key = PROFILE_KEY_BY_FIELD_TYPE[fieldType];
  const value = key ? profile[key] : undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Runs the generic SCAN → MATCH → FILL → VERIFY workflow for this document. */
export async function runGenericAutofill(
  profile: Profile,
  adapter = new GenericHtmlAdapter(),
): Promise<DetectedField[]> {
  if (!adapter.isApplicable()) {
    return [];
  }

  return Promise.all(adapter.findQuestions().map(async (question) => {
    const input = adapter.findInput(question);
    const signals = adapter.getQuestionText(question);
    const match = scoreField(signals);
    const detectedField: DetectedField = {
      elementRef: new WeakRef(input ?? question),
      signals,
      candidateType: match.type,
      confidence: match.confidence,
      status: "pending",
    };
    const value = getProfileValue(profile, match.type);

    if (!input || match.confidence < AUTO_FILL_CONFIDENCE || !value) {
      detectedField.status = "skipped";
      return detectedField;
    }

    adapter.setValue(input, value);
    detectedField.status = (await adapter.verifyValue(input, value))
      ? "filled"
      : "verify_failed";
    return detectedField;
  }));
}
