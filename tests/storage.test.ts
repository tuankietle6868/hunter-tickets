import { afterEach, describe, expect, it, vi } from "vitest";

import { getProfile, PROFILE_STORAGE_KEY, setProfile } from "../src/shared/storage";
import type { Profile } from "../src/shared/types";

type ChromeGlobal = typeof globalThis & { chrome?: unknown };

const chromeGlobal = globalThis as ChromeGlobal;
const originalChrome = chromeGlobal.chrome;

afterEach(() => {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome,
  });
});

describe("Profile storage", () => {
  it("returns the same profile after saving it", async () => {
    const items: Record<string, unknown> = {};
    const get = vi.fn(async (key: string) => ({ [key]: items[key] }));
    const set = vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(items, values);
    });
    const profile: Profile = {
      fullName: "Nguyễn Văn An",
      phone: "0901234567",
      email: "an@example.com",
    };

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: { storage: { local: { get, set } } },
    });

    await setProfile(profile);

    await expect(getProfile()).resolves.toEqual(profile);
    expect(set).toHaveBeenCalledWith({ [PROFILE_STORAGE_KEY]: profile });
    expect(get).toHaveBeenCalledWith(PROFILE_STORAGE_KEY);
  });
});
