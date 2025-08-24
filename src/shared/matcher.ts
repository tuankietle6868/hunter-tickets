import { ALIAS_DICTIONARY, type AliasEntry } from "./aliasDictionary";
import type { FieldType } from "./types";

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
