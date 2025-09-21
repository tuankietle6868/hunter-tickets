import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FIELD_MATCH_FEEDBACK_STORAGE_KEY,
  getFieldMatchFeedback,
  getProfile,
  isOverlayAutoEnabled,
  OVERLAY_SETTINGS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  setOverlayAutoEnabled,
  saveFieldMatchFeedback,
  setProfile,
} from "../src/shared/storage";
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

  it("stores the automatic-overlay preference per domain", async () => {
    const items: Record<string, unknown> = {};
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        storage: {
          local: {
            get: async (key: string) => ({ [key]: items[key] }),
            set: async (values: Record<string, unknown>) => Object.assign(items, values),
          },
        },
      },
    });

    await setOverlayAutoEnabled("docs.google.com", false);

    await expect(isOverlayAutoEnabled("docs.google.com")).resolves.toBe(false);
    await expect(isOverlayAutoEnabled("example.com")).resolves.toBe(true);
    expect(items[OVERLAY_SETTINGS_STORAGE_KEY]).toEqual({
      autoEnabledByDomain: { "docs.google.com": false },
    });
  });

  it("stores only a corrected question mapping for its current domain", async () => {
    const items: Record<string, unknown> = {};
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        storage: {
          local: {
            get: async (key: string) => ({ [key]: items[key] }),
            set: async (values: Record<string, unknown>) => Object.assign(items, values),
          },
        },
      },
    });

    await saveFieldMatchFeedback(
      "event.example",
      { labelText: "Mã người tham dự" },
      "ID_NUMBER",
      "FULL_NAME",
    );

    await expect(getFieldMatchFeedback("event.example")).resolves.toEqual([
      {
        questionText: "Mã người tham dự",
        correctedFrom: "ID_NUMBER",
        correctedTo: "FULL_NAME",
      },
    ]);
    await expect(getFieldMatchFeedback("other.example")).resolves.toEqual([]);
    expect(items[FIELD_MATCH_FEEDBACK_STORAGE_KEY]).toEqual({
      byDomain: {
        "event.example": [
          {
            questionText: "Mã người tham dự",
            correctedFrom: "ID_NUMBER",
            correctedTo: "FULL_NAME",
          },
        ],
      },
    });
  });
});
