import { afterEach, describe, expect, it, vi } from "vitest";

import { PROFILE_STORAGE_KEY } from "../src/shared/storage";

type ChromeGlobal = typeof globalThis & { chrome?: unknown };

const chromeGlobal = globalThis as ChromeGlobal;
const originalChrome = chromeGlobal.chrome;

function installStorage(items: Record<string, unknown>) {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: items[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => Object.assign(items, values)),
        },
      },
    },
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome,
  });
});

describe("Profile popup", () => {
  it("loads the saved profile after the popup is reopened", async () => {
    const items: Record<string, unknown> = {};
    installStorage(items);
    document.body.innerHTML = '<main id="app"></main>';

    await import("../src/popup/index.ts?first-open");
    const form = document.querySelector<HTMLFormElement>("#profile-form");
    expect(form).not.toBeNull();

    const values = {
      fullName: "Nguyễn Văn An",
      idNumber: "012345678901",
      phone: "0901234567",
      email: "an@example.com",
      dateOfBirth: "1999-10-20",
      address: "Quận 1, TP. Hồ Chí Minh",
    };
    for (const [name, value] of Object.entries(values)) {
      (form!.elements.namedItem(name) as HTMLInputElement).value = value;
    }

    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(items[PROFILE_STORAGE_KEY]).toEqual(values));

    document.body.innerHTML = '<main id="app"></main>';
    await import("../src/popup/index.ts?reopened");

    await vi.waitFor(() => {
      expect((document.querySelector("#fullName") as HTMLInputElement).value).toBe(values.fullName);
      expect((document.querySelector("#address") as HTMLInputElement).value).toBe(values.address);
    });
  });
});
