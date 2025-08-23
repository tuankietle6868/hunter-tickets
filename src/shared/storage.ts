import type { Profile } from "./types";

export const PROFILE_STORAGE_KEY = "profile";

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
