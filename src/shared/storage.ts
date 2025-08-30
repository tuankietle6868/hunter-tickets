import type { Profile } from "./types";

export const PROFILE_STORAGE_KEY = "profile";
export const OVERLAY_SETTINGS_STORAGE_KEY = "overlaySettings";

export interface OverlaySettings {
  /** A missing domain defaults to enabled so existing users keep current behaviour. */
  autoEnabledByDomain: Record<string, boolean>;
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
