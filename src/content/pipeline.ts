import { scoreField } from "../shared/matcher";
import type { DetectedField, FieldType, Profile } from "../shared/types";
import { GenericHtmlAdapter } from "./adapters/genericHtmlAdapter";
import { classifyControl, getNativeCheckboxMode, getNativeSelectMode } from "./controlType";
import {
  fillBirthYearSelect,
  fillSeparateDateSelects,
  formatValueForInput,
} from "./dateValue";

/** Minimum matching confidence required for automatic filling. */
export const AUTO_FILL_CONFIDENCE = 80;

const PROFILE_KEY_BY_FIELD_TYPE: Partial<Record<FieldType, keyof Profile>> = {
  FULL_NAME: "fullName",
  ID_NUMBER: "idNumber",
  PHONE: "phone",
  EMAIL: "email",
  DATE_OF_BIRTH: "dateOfBirth",
  ADDRESS: "address",
  GENDER: "gender",
};

function getProfileValue(profile: Profile, fieldType: FieldType): string | undefined {
  const key = PROFILE_KEY_BY_FIELD_TYPE[fieldType];
  const value = key ? profile[key] : undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type DateSelectPart = "day" | "month" | "year";

function dateSelectPart(select: HTMLSelectElement): DateSelectPart | undefined {
  const label = Array.from(select.labels ?? [], (element) => element.textContent ?? "").join(" ");
  const hint = [select.name, select.id, select.getAttribute("aria-label"), label]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");
  if (/(^|[-_\s])(?:birth[-_\s]?)?(?:day|ngay)(?=$|[-_\s])/.test(hint)) return "day";
  if (/(^|[-_\s])(?:birth[-_\s]?)?(?:month|thang)(?=$|[-_\s])/.test(hint)) return "month";
  if (/(^|[-_\s])(?:birth[-_\s]?)?(?:year|nam)(?=$|[-_\s])/.test(hint)) return "year";
  return undefined;
}

function isBirthDateSelect(select: HTMLSelectElement): boolean {
  const scope = select.closest("fieldset")?.textContent ?? "";
  const hint = [select.name, select.id, select.getAttribute("aria-label"), scope]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");
  return /birth|dob|ngay sinh|nam sinh/.test(hint);
}

/** Fills either a 3-part DOB group or its standalone birth-year variant. */
function fillNativeBirthDateSelect(
  select: HTMLSelectElement,
  dateOfBirth: string,
  handled: WeakMap<HTMLSelectElement, boolean>,
): boolean | undefined {
  const part = dateSelectPart(select);
  if (!part || !isBirthDateSelect(select)) return undefined;

  const container = select.closest("fieldset") ?? select.parentElement;
  const parts = Array.from(container?.querySelectorAll<HTMLSelectElement>("select") ?? []).reduce<
    Partial<Record<DateSelectPart, HTMLSelectElement>>
  >((found, candidate) => {
    const candidatePart = dateSelectPart(candidate);
    if (candidatePart && isBirthDateSelect(candidate)) found[candidatePart] = candidate;
    return found;
  }, {});

  if (parts.day && parts.month && parts.year) {
    const existing = handled.get(select);
    if (existing !== undefined) return existing;
    const success = fillSeparateDateSelects(dateOfBirth, {
      day: parts.day,
      month: parts.month,
      year: parts.year,
    });
    [parts.day, parts.month, parts.year].forEach((partSelect) => handled.set(partSelect, success));
    return success;
  }

  if (part === "year") {
    const existing = handled.get(select);
    if (existing !== undefined) return existing;
    const success = fillBirthYearSelect(dateOfBirth, select);
    handled.set(select, success);
    return success;
  }

  return undefined;
}

/** Runs the generic SCAN → MATCH → FILL → VERIFY workflow for this document. */
export async function runGenericAutofill(
  profile: Profile,
  adapter = new GenericHtmlAdapter(),
): Promise<DetectedField[]> {
  if (!adapter.isApplicable()) {
    return [];
  }

  const handledBirthDateSelects = new WeakMap<HTMLSelectElement, boolean>();

  return Promise.all(
    adapter.findQuestions().map(async (question) => {
      const input = adapter.findInput(question);
      const signals = adapter.getQuestionText(question);
      const match = scoreField(signals);
      const detectedField: DetectedField = {
        elementRef: new WeakRef(input ?? question),
        controlType: classifyControl(input ?? question),
        selectMode: getNativeSelectMode(input),
        checkboxMode: getNativeCheckboxMode(input),
        signals,
        candidateType: match.type,
        confidence: match.confidence,
        status: "pending",
      };
      const value = getProfileValue(profile, match.type);

      if (input instanceof HTMLSelectElement && profile.dateOfBirth) {
        const didFill = fillNativeBirthDateSelect(
          input,
          profile.dateOfBirth,
          handledBirthDateSelects,
        );
        if (didFill !== undefined) {
          detectedField.candidateType = "DATE_OF_BIRTH";
          detectedField.confidence = 100;
          detectedField.status = didFill ? "filled" : "verify_failed";
          return detectedField;
        }
      }

      if (!input || match.confidence < AUTO_FILL_CONFIDENCE || !value) {
        detectedField.status = "skipped";
        return detectedField;
      }

      const formattedValue = formatValueForInput(value, match.type, input);
      adapter.setValue(input, formattedValue);
      detectedField.status = (await adapter.verifyValue(input, formattedValue))
        ? "filled"
        : "verify_failed";
      return detectedField;
    }),
  );
}
