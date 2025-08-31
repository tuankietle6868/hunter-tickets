import { ALIAS_DICTIONARY, hasNegativeMatch, type AliasEntry } from "./aliasDictionary";
import { mapAutocompleteToFieldType } from "./autocomplete";
import { cleanQuestionText, normalize, stripDiacritics } from "./normalizer";
import type { FieldSignals, FieldType } from "./types";

export const SIGNAL_WEIGHTS = {
  autocomplete: 1.0,
  visibleQuestionText: 0.9,
  labelText: 0.9,
  ariaLabel: 0.8,
  ariaLabelledByText: 0.8,
  placeholder: 0.6,
  name: 0.5,
  id: 0.4,
  surroundingText: 0.3,
} as const satisfies Partial<Record<keyof FieldSignals, number>>;

const SCORABLE_FIELD_TYPES: FieldType[] = [
  "FULL_NAME",
  "ID_NUMBER",
  "PHONE",
  "EMAIL",
  "DATE_OF_BIRTH",
  "ADDRESS",
  "GENDER",
];

function matchesAlias(value: string, alias: AliasEntry): boolean {
  switch (alias.matchType) {
    case "exact":
      return value === alias.pattern;
    case "contains":
      return value.includes(alias.pattern);
    case "regex":
      return new RegExp(alias.pattern, "u").test(value);
  }
}

/**
 * Returns the largest weight among aliases that match a normalized value.
 * An optional alias list keeps the matching primitive reusable in tests and
 * for future field-specific alias extensions.
 */
export function bestAliasMatch(
  fieldType: FieldType,
  normalizedValue: string,
  aliases: readonly AliasEntry[] = ALIAS_DICTIONARY[fieldType],
): number | undefined {
  let highestWeight: number | undefined;

  for (const alias of aliases) {
    if (matchesAlias(normalizedValue, alias)) {
      highestWeight = Math.max(highestWeight ?? alias.weight, alias.weight);
    }
  }

  return highestWeight;
}

/** Scores all available field signals and returns the most likely field type. */
export function scoreField(signals: FieldSignals): {
  type: FieldType;
  confidence: number;
} {
  const scoresByType: Record<FieldType, number> = {
    FULL_NAME: 0,
    ID_NUMBER: 0,
    PHONE: 0,
    EMAIL: 0,
    DATE_OF_BIRTH: 0,
    ADDRESS: 0,
    GENDER: 0,
    UNKNOWN: 0,
  };

  for (const [signalKey, weight] of Object.entries(SIGNAL_WEIGHTS) as [
    keyof typeof SIGNAL_WEIGHTS,
    number,
  ][]) {
    const rawValue = signals[signalKey];
    if (!rawValue) {
      continue;
    }

    if (signalKey === "autocomplete") {
      const fieldType = mapAutocompleteToFieldType(rawValue);
      if (fieldType !== "UNKNOWN") {
        scoresByType[fieldType] += 100 * weight;
      }
      continue;
    }

    const normalizedValue = stripDiacritics(normalize(cleanQuestionText(rawValue)));

    for (const fieldType of SCORABLE_FIELD_TYPES) {
      if (hasNegativeMatch(fieldType, normalizedValue)) {
        continue;
      }

      const bestWeight = bestAliasMatch(fieldType, normalizedValue);
      if (bestWeight !== undefined) {
        scoresByType[fieldType] += bestWeight * weight;
      }
    }
  }

  let bestType: FieldType = "UNKNOWN";
  let bestScore = 0;

  for (const fieldType of SCORABLE_FIELD_TYPES) {
    if (scoresByType[fieldType] > bestScore) {
      bestType = fieldType;
      bestScore = scoresByType[fieldType];
    }
  }

  return {
    type: bestType,
    confidence: Math.min(100, bestScore),
  };
}
