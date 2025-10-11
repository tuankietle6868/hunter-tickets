import {
  getProfile,
  isOverlayAutoEnabled,
  setOverlayAutoEnabled,
  setProfile,
} from "../shared/storage";
import type { Profile } from "../shared/types";
import "./popup.css";

const fields: Array<{
  key: keyof Profile;
  label: string;
  type: "text" | "email" | "tel" | "date";
  autocomplete?: string;
  placeholder?: string;
}> = [
  {
    key: "fullName",
    label: "Họ và tên",
    type: "text",
    autocomplete: "name",
    placeholder: "Nguyễn Văn A",
  },
  {
    key: "idNumber",
    label: "Số CCCD",
    type: "text",
    autocomplete: "off",
    placeholder: "012345678901",
  },
  {
    key: "phone",
    label: "Số điện thoại",
    type: "tel",
    autocomplete: "tel",
    placeholder: "0901 234 567",
  },
  {
    key: "email",
    label: "Email",
    type: "email",
    autocomplete: "email",
    placeholder: "ten@email.com",
  },
  { key: "dateOfBirth", label: "Ngày sinh", type: "date", autocomplete: "bday" },
  {
    key: "address",
    label: "Địa chỉ",
    type: "text",
    autocomplete: "street-address",
    placeholder: "Số nhà, đường, phường/xã...",
  },
  {
    key: "gender",
    label: "Giới tính",
    type: "text",
    autocomplete: "sex",
    placeholder: "Nam, Nữ hoặc Khác",
  },
  {
    key: "province",
    label: "Tỉnh/Thành phố",
    type: "text",
    placeholder: "Hồ Chí Minh",
  },
  {
    key: "ward",
    label: "Phường/Xã",
    type: "text",
    placeholder: "Phường Bến Nghé",
  },
];

type TabsApi = {
  query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number; url?: string }>>;
};

type ActiveTab = { id?: number; url?: string };

type PermissionsApi = {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
};

type ScriptingApi = {
  executeScript(injection: { target: { tabId: number }; files: string[] }): Promise<unknown>;
};

type ChromeApi = {
  tabs?: TabsApi;
  permissions?: PermissionsApi;
  scripting?: ScriptingApi;
};

const optionalDomainLabels: Record<string, string> = {
  "ticketbox.vn": "Ticketbox",
  "cticket.vn": "CTicket",
  "forms.office.com": "Microsoft Forms",
  "forms.cloud.microsoft": "Microsoft Forms",
};

function getOptionalDomain(hostname: string): string | undefined {
  return Object.keys(optionalDomainLabels).find(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function getActiveTab(): Promise<ActiveTab | undefined> {
  const tabs = (globalThis as typeof globalThis & { chrome?: { tabs?: TabsApi } }).chrome?.tabs;
  if (!tabs) return Promise.resolve(undefined);

  return tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => tab)
    .catch(() => undefined);
}

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Popup root was not found");
}

app.innerHTML = `
  <section class="profile-card" aria-labelledby="popup-title">
    <header class="profile-header">
      <span class="profile-icon" aria-hidden="true">⌁</span>
      <div>
        <p class="eyebrow">SMART FORM AUTOFILL</p>
        <h1 id="popup-title">Hồ sơ cá nhân</h1>
      </div>
    </header>
    <p class="intro">Thông tin được lưu cục bộ trên trình duyệt của bạn.</p>
    <form id="profile-form" novalidate>
      <div class="form-fields">
        ${fields
          .map(
            ({ key, label, type, autocomplete, placeholder }) => `
              <label class="field" for="${key}">
                <span>${label}</span>
                <input id="${key}" name="${key}" type="${type}" autocomplete="${autocomplete ?? "off"}" aria-describedby="${key}-error"${placeholder ? ` placeholder="${placeholder}"` : ""} />
                <span id="${key}-error" class="field-error" aria-live="polite"></span>
              </label>`,
          )
          .join("")}
      </div>
      <p id="form-status" class="form-status" role="status" aria-live="polite"></p>
      <button type="submit" class="save-button">Lưu hồ sơ</button>
    </form>
    <section class="overlay-setting" aria-labelledby="overlay-setting-title">
      <div>
        <p id="overlay-setting-title">Overlay tự động</p>
        <span id="overlay-domain">Đang xác định website...</span>
      </div>
      <label class="switch" for="auto-overlay">
        <span class="sr-only">Bật overlay tự động cho website này</span>
        <input id="auto-overlay" type="checkbox" role="switch" disabled />
        <span class="switch-track" aria-hidden="true"></span>
      </label>
    </section>
    <section id="site-permission" class="site-permission" aria-labelledby="site-permission-title" hidden>
      <div>
        <p id="site-permission-title">Quyền truy cập website</p>
        <span id="site-permission-description"></span>
      </div>
      <button id="request-site-permission" type="button" class="permission-button"></button>
    </section>
  </section>
`;

const form = app.querySelector<HTMLFormElement>("#profile-form");
const status = app.querySelector<HTMLParagraphElement>("#form-status");
const saveButton = app.querySelector<HTMLButtonElement>(".save-button");
const overlayToggle = app.querySelector<HTMLInputElement>("#auto-overlay");
const overlayDomain = app.querySelector<HTMLElement>("#overlay-domain");
const sitePermission = app.querySelector<HTMLElement>("#site-permission");
const sitePermissionDescription = app.querySelector<HTMLElement>("#site-permission-description");
const requestSitePermissionButton = app.querySelector<HTMLButtonElement>("#request-site-permission");

if (
  !form ||
  !status ||
  !saveButton ||
  !overlayToggle ||
  !overlayDomain ||
  !sitePermission ||
  !sitePermissionDescription ||
  !requestSitePermissionButton
) {
  throw new Error("Popup form could not be initialized");
}

function setStatus(message: string, variant: "success" | "error" | "") {
  status.textContent = message;
  status.className = `form-status${variant ? ` is-${variant}` : ""}`;
}

function populateForm(profile: Profile) {
  for (const { key } of fields) {
    const input = form.elements.namedItem(key) as HTMLInputElement | null;
    if (input) input.value = profile[key] ?? "";
  }
}

function getValidationMessage(input: HTMLInputElement): string {
  const value = input.value.trim();
  if (!value) return "";

  switch (input.name as keyof Profile) {
    case "phone": {
      const normalized = value.replace(/[.\s-]/g, "");
      return /^(?:0|\+84)[35789]\d{8}$/.test(normalized)
        ? ""
        : "Số điện thoại phải là 10 số (ví dụ: 0901234567).";
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Vui lòng nhập địa chỉ email hợp lệ.";
    case "idNumber":
      return /^\d{9}$|^\d{12}$/.test(value) ? "" : "CCCD phải gồm 9 hoặc 12 chữ số.";
    case "dateOfBirth":
      return value <= new Date().toISOString().slice(0, 10)
        ? ""
        : "Ngày sinh không thể ở tương lai.";
    default:
      return "";
  }
}

function validateInput(input: HTMLInputElement): boolean {
  const message = getValidationMessage(input);
  const error = document.querySelector<HTMLElement>(`#${input.name}-error`);

  input.setCustomValidity(message);
  input.classList.toggle("has-error", Boolean(message));
  input.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) error.textContent = message;
  return !message;
}

async function loadProfile() {
  try {
    populateForm((await getProfile()) ?? {});
  } catch {
    setStatus("Không thể tải hồ sơ. Hãy thử mở lại tiện ích.", "error");
  }
}

async function loadOverlaySetting() {
  const tab = await getActiveTab();
  if (!tab?.url) {
    overlayDomain.textContent = "Không thể xác định website hiện tại";
    return;
  }

  let pageUrl: URL;
  try {
    pageUrl = new URL(tab.url);
  } catch {
    overlayDomain.textContent = "Không thể xác định website hiện tại";
    return;
  }
  const domain = pageUrl.hostname;

  try {
    overlayToggle.checked = await isOverlayAutoEnabled(domain);
    overlayToggle.disabled = false;
    overlayDomain.textContent = domain;
  } catch {
    overlayDomain.textContent = "Không thể tải cài đặt cho website này";
  }

  overlayToggle.addEventListener("change", async () => {
    const enabled = overlayToggle.checked;
    overlayToggle.disabled = true;
    try {
      await setOverlayAutoEnabled(domain, enabled);
    } catch {
      overlayToggle.checked = !enabled;
      setStatus("Không thể lưu cài đặt overlay. Vui lòng thử lại.", "error");
    } finally {
      overlayToggle.disabled = false;
    }
  });

  const supportedDomain = getOptionalDomain(domain);
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;
  if (!supportedDomain || pageUrl.protocol !== "https:" || !chromeApi?.permissions) return;

  const origin = `https://${domain}/*`;
  sitePermission.hidden = false;
  try {
    const hasPermission = await chromeApi.permissions.contains({ origins: [origin] });
    updateSitePermissionUi(hasPermission, domain, supportedDomain);
  } catch {
    sitePermissionDescription.textContent = "Không thể kiểm tra quyền truy cập website này.";
    requestSitePermissionButton.hidden = true;
  }

  requestSitePermissionButton.addEventListener("click", async () => {
    requestSitePermissionButton.disabled = true;
    try {
      const granted = await chromeApi.permissions!.request({ origins: [origin] });
      if (!granted) {
        setStatus("Bạn chưa cấp quyền truy cập website này.", "error");
        requestSitePermissionButton.disabled = false;
        return;
      }

      if (tab.id !== undefined && chromeApi.scripting) {
        await chromeApi.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/index.js"],
        });
      }
      updateSitePermissionUi(true, domain, supportedDomain);
      setStatus(`Đã cấp quyền cho ${domain}.`, "success");
    } catch {
      setStatus("Không thể cấp quyền. Vui lòng thử lại.", "error");
      requestSitePermissionButton.disabled = false;
    }
  });
}

function updateSitePermissionUi(granted: boolean, domain: string, supportedDomain: string) {
  if (granted) {
    sitePermissionDescription.textContent = `Đã cho phép tự động điền trên ${domain}.`;
    requestSitePermissionButton.hidden = true;
    return;
  }

  sitePermissionDescription.textContent = `Cấp quyền riêng cho ${domain} để tự động điền biểu mẫu ${optionalDomainLabels[supportedDomain]}.`;
  requestSitePermissionButton.hidden = false;
  requestSitePermissionButton.disabled = false;
  requestSitePermissionButton.textContent = "Cấp quyền";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const invalidInputs = fields
    .map(({ key }) => form.elements.namedItem(key) as HTMLInputElement)
    .filter((input) => !validateInput(input));
  if (invalidInputs.length > 0) {
    invalidInputs[0].focus();
    setStatus("Vui lòng kiểm tra lại các trường được đánh dấu.", "error");
    return;
  }

  const profile = fields.reduce<Profile>((result, { key }) => {
    const input = form.elements.namedItem(key) as HTMLInputElement;
    const value = input.value.trim();
    if (value) result[key] = value;
    return result;
  }, {});

  saveButton.disabled = true;
  saveButton.textContent = "Đang lưu...";
  setStatus("", "");

  try {
    await setProfile(profile);
    setStatus("Đã lưu hồ sơ.", "success");
  } catch {
    setStatus("Không thể lưu hồ sơ. Vui lòng thử lại.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Lưu hồ sơ";
  }
});

for (const { key } of fields) {
  const input = form.elements.namedItem(key) as HTMLInputElement;
  input.addEventListener("blur", () => validateInput(input));
  input.addEventListener("input", () => {
    if (input.classList.contains("has-error")) validateInput(input);
  });
}

void loadProfile();
void loadOverlaySetting();
