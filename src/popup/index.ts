import { getProfile, setProfile } from "../shared/storage";
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
];

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
                <input id="${key}" name="${key}" type="${type}" autocomplete="${autocomplete ?? "off"}"${placeholder ? ` placeholder="${placeholder}"` : ""} />
              </label>`,
          )
          .join("")}
      </div>
      <p id="form-status" class="form-status" role="status" aria-live="polite"></p>
      <button type="submit" class="save-button">Lưu hồ sơ</button>
    </form>
  </section>
`;

const form = app.querySelector<HTMLFormElement>("#profile-form");
const status = app.querySelector<HTMLParagraphElement>("#form-status");
const saveButton = app.querySelector<HTMLButtonElement>(".save-button");

if (!form || !status || !saveButton) {
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

async function loadProfile() {
  try {
    populateForm((await getProfile()) ?? {});
  } catch {
    setStatus("Không thể tải hồ sơ. Hãy thử mở lại tiện ích.", "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
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

void loadProfile();
