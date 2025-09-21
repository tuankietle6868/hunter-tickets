import type { FieldMatchFeedback, FieldSignals, FieldType, Profile } from "./types";

export const PROFILE_STORAGE_KEY = "profile";
export const OVERLAY_SETTINGS_STORAGE_KEY = "overlaySettings";
export const FIELD_MATCH_FEEDBACK_STORAGE_KEY = "fieldMatchFeedback";

export interface OverlaySettings {
  /** A missing domain defaults to enabled so existing users keep current behaviour. */
  autoEnabledByDomain: Record<string, boolean>;
}

interface FieldMatchFeedbackStore {
  byDomain: Record<string, FieldMatchFeedback[]>;
}

function getQuestionText(signals: FieldSignals): string | undefined {
  return (
    signals.visibleQuestionText ??
    signals.labelText ??
    signals.ariaLabelledByText ??
    signals.ariaLabel ??
    signals.placeholder ??
    signals.name ??
    signals.id
  )
    ?.trim()
    .replace(/\s+/g, " ");
}

type StorageLocalArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

function getLocalStorage(): StorageLocalArea {
  const local = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { local?: StorageLocalArea } };
    }
  ).chrome?.storage?.local;

  if (!local) {
    throw new Error("chrome.storage.local is unavailable");
  }

  return local;
}

/** Saves a profile only in the browser's local extension storage. */
export async function setProfile(profile: Profile): Promise<void> {
  await getLocalStorage().set({ [PROFILE_STORAGE_KEY]: profile });
}

/** Returns the stored profile, or undefined when the user has not saved one yet. */
export async function getProfile(): Promise<Profile | undefined> {
  const items = await getLocalStorage().get(PROFILE_STORAGE_KEY);
  return items[PROFILE_STORAGE_KEY] as Profile | undefined;
}

/** Returns whether automatic overlay UI is enabled for a hostname. */
export async function isOverlayAutoEnabled(domain: string): Promise<boolean> {
  const items = await getLocalStorage().get(OVERLAY_SETTINGS_STORAGE_KEY);
  const settings = items[OVERLAY_SETTINGS_STORAGE_KEY] as OverlaySettings | undefined;
  return settings?.autoEnabledByDomain[domain] !== false;
}

/** Persists the automatic-overlay preference for one hostname only. */
export async function setOverlayAutoEnabled(domain: string, enabled: boolean): Promise<void> {
  const local = getLocalStorage();
  const items = await local.get(OVERLAY_SETTINGS_STORAGE_KEY);
  const current = items[OVERLAY_SETTINGS_STORAGE_KEY] as OverlaySettings | undefined;
  await local.set({
    [OVERLAY_SETTINGS_STORAGE_KEY]: {
      autoEnabledByDomain: {
        ...current?.autoEnabledByDomain,
        [domain]: enabled,
      },
    } satisfies OverlaySettings,
  });
}

/** Returns user-confirmed mappings that apply only to the current hostname. */
export async function getFieldMatchFeedback(domain: string): Promise<FieldMatchFeedback[]> {
  const items = await getLocalStorage().get(FIELD_MATCH_FEEDBACK_STORAGE_KEY);
  const store = items[FIELD_MATCH_FEEDBACK_STORAGE_KEY] as FieldMatchFeedbackStore | undefined;
  return store?.byDomain[domain] ?? [];
}

/**
 * Stores one corrected mapping locally. Existing corrections for the same
 * visible question replace one another, keeping the newest user choice.
 */
export async function saveFieldMatchFeedback(
  domain: string,
  signals: FieldSignals,
  correctedFrom: FieldType,
  correctedTo: FieldType,
): Promise<boolean> {
  const questionText = getQuestionText(signals);
  if (!questionText || correctedTo === "UNKNOWN") return false;

  const local = getLocalStorage();
  const items = await local.get(FIELD_MATCH_FEEDBACK_STORAGE_KEY);
  const store = items[FIELD_MATCH_FEEDBACK_STORAGE_KEY] as FieldMatchFeedbackStore | undefined;
  const current = store?.byDomain[domain] ?? [];
  const feedback: FieldMatchFeedback = { questionText, correctedFrom, correctedTo };
  const existingIndex = current.findIndex(
    (entry) => entry.questionText.localeCompare(questionText, undefined, { sensitivity: "accent" }) === 0,
  );
  const next = [...current];
  if (existingIndex >= 0) next[existingIndex] = feedback;
  else next.push(feedback);

  await local.set({
    [FIELD_MATCH_FEEDBACK_STORAGE_KEY]: {
      byDomain: {
        ...store?.byDomain,
        // Keep feedback bounded while allowing corrections for sizeable forms.
        [domain]: next.slice(-100),
      },
    } satisfies FieldMatchFeedbackStore,
  });
  return true;
}
