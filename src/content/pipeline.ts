import { scoreField } from "../shared/matcher";
import type { DetectedField, FieldMatchFeedback, FieldType, Profile } from "../shared/types";
import { GenericHtmlAdapter } from "./adapters/genericHtmlAdapter";
import { classifyControl, getNativeCheckboxMode, getNativeSelectMode } from "./controlType";
import {
  fillBirthYearSelect,
  fillSeparateDateSelects,
  formatValueForInput,
} from "./dateValue";
import {
  isAutoFillPermitted,
  isHardPolicyBlocked,
  isProfileConfirmationField,
} from "./policy";
import { isCssHidden, isOffscreenHoneypot } from "./visibility";
import { acceptsFormattedValue } from "./inputConstraints";
import {
  fillCustomSelectByText,
  fillMultiCheckboxGroup,
  verifyCustomSelectByText,
  verifyMultiCheckboxGroup,
} from "./choiceControls";
import { createStableElementLocator, resolveLiveElement } from "./liveElement";
import { detectedFieldCache, type FieldGroup } from "./fieldCache";
import { logInstantFieldDuration, performanceNow } from "./performance";

/** Minimum matching confidence required for automatic filling. */
export const AUTO_FILL_CONFIDENCE = 80;

export interface AutofillProgress {
  /** Called as soon as a non-cascading field has completed SCAN → FILL → VERIFY. */
  onIndependentFieldComplete?: (field: DetectedField) => void;
  /** User-confirmed local mappings for the active hostname. */
  learnedFeedback?: readonly FieldMatchFeedback[];
}

const PROFILE_KEY_BY_FIELD_TYPE: Partial<Record<FieldType, keyof Profile>> = {
  FULL_NAME: "fullName",
  ID_NUMBER: "idNumber",
  PHONE: "phone",
  EMAIL: "email",
  DATE_OF_BIRTH: "dateOfBirth",
  ADDRESS: "address",
  GENDER: "gender",
  PROVINCE: "province",
  WARD: "ward",
  DISTRICT_LEGACY: "districtLegacy",
};

function getProfileValue(profile: Profile, fieldType: FieldType): string | undefined {
  const key = PROFILE_KEY_BY_FIELD_TYPE[fieldType];
  const value = key ? profile[key] : undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function hasExistingValue(input: HTMLElement): boolean {
  if (input instanceof HTMLInputElement) {
    if (input.type === "radio") {
      if (!input.name) return input.checked;
      return Array.from(
        (input.form ?? input.ownerDocument).querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ).some((candidate) => candidate.name === input.name && candidate.form === input.form && candidate.checked);
    }
    if (input.type === "checkbox") return input.checked;
    return input.value.trim().length > 0;
  }
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
    return input.value.trim().length > 0;
  }
  return input.isContentEditable && (input.textContent?.trim().length ?? 0) > 0;
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

function registerFieldGroups(fields: readonly DetectedField[]): void {
  const selectFields = fields.flatMap((field) => {
    const element = field.elementRef.deref();
    return element instanceof HTMLSelectElement ? [{ field, element }] : [];
  });
  const registeredDateSelects = new Set<HTMLSelectElement>();

  for (const { element } of selectFields) {
    if (registeredDateSelects.has(element) || !isBirthDateSelect(element)) continue;
    const container = element.closest("fieldset") ?? element.parentElement;
    const members = Array.from(container?.querySelectorAll<HTMLSelectElement>("select") ?? []).filter(
      (candidate) => dateSelectPart(candidate) && isBirthDateSelect(candidate),
    );
    if (members.length < 2) continue;
    members.forEach((member) => registeredDateSelects.add(member));
    detectedFieldCache.registerGroup({ kind: "date_of_birth", elements: members });
  }

  const cascadeMembers = selectFields
    .filter(({ field }) =>
      field.candidateType === "PROVINCE" ||
      field.candidateType === "DISTRICT_LEGACY" ||
      field.candidateType === "WARD",
    )
    .map(({ element }) => element);
  if (cascadeMembers.length > 1) {
    const group: FieldGroup = { kind: "cascade", elements: cascadeMembers };
    detectedFieldCache.registerGroup(group);
  }
}

function isCascadeField(field: DetectedField): boolean {
  return (
    field.candidateType === "PROVINCE" ||
    field.candidateType === "DISTRICT_LEGACY" ||
    field.candidateType === "WARD"
  );
}

/** Runs the generic SCAN → MATCH → FILL → VERIFY workflow for this document. */
export async function runGenericAutofill(
  profile: Profile,
  adapter = new GenericHtmlAdapter(),
  progress?: AutofillProgress,
): Promise<DetectedField[]> {
  if (!adapter.isApplicable()) {
    return [];
  }

  const handledBirthDateSelects = new WeakMap<HTMLSelectElement, boolean>();
  const autoFilledFieldTypes = new Set<FieldType>();

  const results = await Promise.all(
    adapter.findQuestions().map(async (question) => {
      const startedAt = performanceNow();
      let detectedField: DetectedField | undefined;
      try {
        const input = adapter.findInput(question);
        const signals = adapter.getQuestionText(question);
        const match = scoreField(signals, progress?.learnedFeedback);
        const controlType = classifyControl(input ?? question);
        const stableLocator = createStableElementLocator(input ?? question);
        const element = input ?? question;
        detectedField = detectedFieldCache.getOrCreate(element, () => ({
          elementRef: new WeakRef(element),
          stableLocator,
          controlType,
          selectMode: getNativeSelectMode(input),
          checkboxMode: getNativeCheckboxMode(input),
          signals,
          candidateType: match.type,
          confidence: match.confidence,
          status: "pending",
        }));
        detectedField.status = "pending";
        const value = getProfileValue(profile, match.type);

        if (isCssHidden(input ?? question) || isOffscreenHoneypot(input ?? question)) {
          detectedField.status = "skipped";
          return detectedField;
        }

        if (isHardPolicyBlocked(signals, match.type)) {
          detectedField.status = "policy_blocked";
          return detectedField;
        }

        if (match.ambiguous) {
          detectedField.status = "ambiguous";
          return detectedField;
        }

        if (
          input instanceof HTMLSelectElement &&
          profile.dateOfBirth &&
          isAutoFillPermitted("DATE_OF_BIRTH", controlType)
        ) {
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

        if (!input || !value) {
          detectedField.status = "skipped";
          return detectedField;
        }

        if (match.confidence < AUTO_FILL_CONFIDENCE) {
          detectedField.status = "low_confidence";
          return detectedField;
        }

        if (!isAutoFillPermitted(match.type, controlType)) {
          detectedField.status = "policy_blocked";
          return detectedField;
        }

        const permitsSameValue =
          match.type === "DATE_OF_BIRTH" || isProfileConfirmationField(signals, match.type);
        const formattedValue = formatValueForInput(value, match.type, input);
        if (!acceptsFormattedValue(input, formattedValue)) {
          detectedField.status = "format_mismatch";
          return detectedField;
        }
        if (input instanceof HTMLInputElement && input.type === "checkbox") {
          const success = fillMultiCheckboxGroup(input, formattedValue);
          detectedField.status =
            success && verifyMultiCheckboxGroup(input, formattedValue) ? "filled" : "verify_failed";
          return detectedField;
        }
        if (controlType === "CUSTOM_SELECT") {
          const success = await fillCustomSelectByText(input, formattedValue);
          detectedField.status =
            success && verifyCustomSelectByText(input, formattedValue) ? "filled" : "verify_failed";
          return detectedField;
        }
        if (hasExistingValue(input)) {
          if (!permitsSameValue) autoFilledFieldTypes.add(match.type);
          detectedField.status = (await adapter.verifyValue(input, formattedValue))
            ? "filled"
            : "prepopulated_mismatch";
          return detectedField;
        }

        if (autoFilledFieldTypes.has(match.type) && !permitsSameValue) {
          detectedField.status = "duplicate_manual";
          return detectedField;
        }
        if (!permitsSameValue) {
          autoFilledFieldTypes.add(match.type);
        }

        adapter.setValue(input, formattedValue);
        const liveInput = resolveLiveElement(stableLocator, input.ownerDocument) ?? input;
        detectedField.elementRef = new WeakRef(liveInput);
        detectedField.status = (await adapter.verifyValue(liveInput, formattedValue))
          ? "filled"
          : "verify_failed";
        return detectedField;
      } finally {
        if (detectedField && !isCascadeField(detectedField)) {
          logInstantFieldDuration(detectedField, performanceNow() - startedAt);
          progress?.onIndependentFieldComplete?.(detectedField);
        }
      }
    }),
  );
  registerFieldGroups(results);
  return results;
}
