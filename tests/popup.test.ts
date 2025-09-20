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

function installTicketboxChrome(options: { granted: boolean }) {
  const executeScript = vi.fn(async () => undefined);
  const request = vi.fn(async () => options.granted);
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: undefined })),
          set: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: "https://www.ticketbox.vn/event/example" }]),
      },
      permissions: {
        contains: vi.fn(async () => false),
        request,
      },
      scripting: { executeScript },
    },
  });
  return { executeScript, request };
}

afterEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome,
  });
});

describe("Profile popup", () => {
  it("shows inline errors and does not save invalid phone or email values", async () => {
    const items: Record<string, unknown> = {};
    installStorage(items);
    document.body.innerHTML = '<main id="app"></main>';

    await import("../src/popup/index.ts?validation");
    const form = document.querySelector<HTMLFormElement>("#profile-form");
    (form!.elements.namedItem("phone") as HTMLInputElement).value = "12345";
    (form!.elements.namedItem("email") as HTMLInputElement).value = "not-an-email";

    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.querySelector("#phone-error")?.textContent).toContain(
      "Số điện thoại phải là 10 số",
    );
    expect(document.querySelector("#email-error")?.textContent).toContain("địa chỉ email hợp lệ");
    expect(items[PROFILE_STORAGE_KEY]).toBeUndefined();
  });

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

  it("requests access only for the active supported domain and starts autofill immediately", async () => {
    const { executeScript, request } = installTicketboxChrome({ granted: true });
    document.body.innerHTML = '<main id="app"></main>';

    await import("../src/popup/index.ts?ticketbox-permission");
    const button = document.querySelector<HTMLButtonElement>("#request-site-permission");

    await vi.waitFor(() => expect(button?.textContent).toBe("Cấp quyền"));
    button!.click();

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith({ origins: ["https://www.ticketbox.vn/*"] });
      expect(executeScript).toHaveBeenCalledWith({
        target: { tabId: 42 },
        files: ["content/index.js"],
      });
    });
    expect(button?.hidden).toBe(true);
  });
});
