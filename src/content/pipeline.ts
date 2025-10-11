import { scoreField } from "../shared/matcher";
import type { DetectedField, FieldMatchFeedback, FieldType, Profile } from "../shared/types";
import type { FieldSignals } from "../shared/types";
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
import { fillCascadingSelectChain, type CascadingSelectStep } from "./selectOptions";
import {
  logFullFormScanMatchDuration,
  logInstantFieldDuration,
  performanceNow,
} from "./performance";

/** Minimum matching confidence required for automatic filling. */
export const AUTO_FILL_CONFIDENCE = 80;

export interface AutofillProgress {
  /** Called as soon as a non-cascading field has completed SCAN → FILL → VERIFY. */
  onIndependentFieldComplete?: (field: DetectedField) => void;
  /** User-confirmed local mappings for the active hostname. */
  learnedFeedback?: readonly FieldMatchFeedback[];
}

/**
 * Finds equally plausible controls for one profile value. A repeated, identical
 * label is handled by the duplicate-field safeguard; distinct labels with a
 * small score gap require the user to choose the intended target.
 */
function ambiguousCandidateIndexes(
  matches: readonly ReturnType<typeof scoreField>[],
  signals: readonly FieldSignals[],
): Set<number> {
  const ambiguous = new Set<number>();

  for (const [index, match] of matches.entries()) {
    if (match.type !== "FULL_NAME" || match.ambiguous || match.confidence < AUTO_FILL_CONFIDENCE) {
      continue;
    }

    const candidateLabel = [
      signals[index].visibleQuestionText,
      signals[index].labelText,
      signals[index].ariaLabel,
      signals[index].placeholder,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");

    for (let otherIndex = index + 1; otherIndex < matches.length; otherIndex += 1) {
      const other = matches[otherIndex];
      if (
        other.type !== match.type ||
        other.ambiguous ||
        other.confidence < AUTO_FILL_CONFIDENCE ||
        Math.abs(match.confidence - other.confidence) >= 15
      ) {
        continue;
      }

      const otherLabel = [
        signals[otherIndex].visibleQuestionText,
        signals[otherIndex].labelText,
        signals[otherIndex].ariaLabel,
        signals[otherIndex].placeholder,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ");
      if (candidateLabel !== otherLabel) {
        ambiguous.add(index);
        ambiguous.add(otherIndex);
      }
    }
  }

  return ambiguous;
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

/** Phone masks may add punctuation while preserving the underlying number. */
function isMatchingMaskedPhone(input: HTMLElement, expected: string, fieldType: FieldType): boolean {
  if (fieldType !== "PHONE" || !(input instanceof HTMLInputElement)) return false;

  const actualDigits = input.value.replace(/\D/g, "");
  const expectedDigits = expected.replace(/\D/g, "");
  return actualDigits.length > 0 && actualDigits === expectedDigits;
}

async function verifyFilledValue(
  adapter: GenericHtmlAdapter,
  input: HTMLElement,
  expected: string,
  fieldType: FieldType,
): Promise<boolean> {
  return isMatchingMaskedPhone(input, expected, fieldType) || (await adapter.verifyValue(input, expected));
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

  const scanMatchStartedAt = performanceNow();
  const handledBirthDateSelects = new WeakMap<HTMLSelectElement, boolean>();
  const autoFilledFieldTypes = new Set<FieldType>();
  const questions = adapter.findQuestions().filter((question) => {
    const input = adapter.findInput(question);
    return !isCssHidden(input ?? question);
  });
  const signalsByQuestion = questions.map((question) => adapter.getQuestionText(question));
  const matches = signalsByQuestion.map((signals) =>
    scoreField(signals, progress?.learnedFeedback),
  );
  const hasCascadingSelectChain =
    matches.filter((match) =>
      ["PROVINCE", "DISTRICT_LEGACY", "WARD"].includes(match.type),
    ).length > 1;
  const ambiguousCandidates = ambiguousCandidateIndexes(matches, signalsByQuestion);
  logFullFormScanMatchDuration(questions.length, performanceNow() - scanMatchStartedAt);

  const results = await Promise.all(
    questions.map(async (question, index) => {
      const startedAt = performanceNow();
      let detectedField: DetectedField | undefined;
      try {
        const input = adapter.findInput(question);
        const signals = signalsByQuestion[index];
        const match = matches[index];
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

        if (match.ambiguous || ambiguousCandidates.has(index)) {
          detectedField.status = "ambiguous";
          return detectedField;
        }

        // Cascade members are filled serially after every other field has
        // been classified. A child can be rendered only after its parent
        // dispatches `change`, so parallel generic filling is unsafe here.
        if (hasCascadingSelectChain && isCascadeField(detectedField)) {
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
          detectedField.status = (await verifyFilledValue(adapter, input, formattedValue, match.type))
            ? "prepopulated"
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
        detectedField.status = (await verifyFilledValue(adapter, liveInput, formattedValue, match.type))
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

  const cascadeSteps = (hasCascadingSelectChain ? results : []).flatMap<CascadingSelectStep>((field) => {
    const element = field.elementRef.deref();
    const value = getProfileValue(profile, field.candidateType);
    return field.status === "pending" && element instanceof HTMLSelectElement && value
      ? [{ select: element, value, detectedField: field }]
      : [];
  });
  if (cascadeSteps.length > 0) {
    for (const { step, status } of await fillCascadingSelectChain(cascadeSteps)) {
      step.detectedField!.status = status;
    }
  }
  registerFieldGroups(results);
  return results;
}
