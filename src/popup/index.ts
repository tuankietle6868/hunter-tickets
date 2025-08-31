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
];

type TabsApi = {
  query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ url?: string }>>;
};

function getActiveDomain(): Promise<string | undefined> {
  const tabs = (globalThis as typeof globalThis & { chrome?: { tabs?: TabsApi } }).chrome?.tabs;
  if (!tabs) return Promise.resolve(undefined);

  return tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => (tab?.url ? new URL(tab.url).hostname : undefined))
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
  </section>
`;

const form = app.querySelector<HTMLFormElement>("#profile-form");
const status = app.querySelector<HTMLParagraphElement>("#form-status");
const saveButton = app.querySelector<HTMLButtonElement>(".save-button");
const overlayToggle = app.querySelector<HTMLInputElement>("#auto-overlay");
const overlayDomain = app.querySelector<HTMLElement>("#overlay-domain");

if (!form || !status || !saveButton || !overlayToggle || !overlayDomain) {
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
  const domain = await getActiveDomain();
  if (!domain) {
    overlayDomain.textContent = "Không thể xác định website hiện tại";
    return;
  }

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
