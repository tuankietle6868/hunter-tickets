import type { DetectedField, FieldType } from "../shared/types";
import { resolveLiveElement } from "./liveElement";

export const OVERLAY_HOST_ID = "smart-form-autofill-overlay-host";
export const OVERLAY_PANEL_ID = "smart-form-autofill-overlay";

export type OverlayVariant = "info" | "warning";

interface OverlayOptions {
  title: string;
  message: string;
  variant?: OverlayVariant;
  content?: string;
  actions?: OverlayActions;
}

export interface OverlayActions {
  onRescan: () => void | Promise<void>;
  onRefill: () => void | Promise<void>;
  onFieldSelect?: (field: DetectedField) => void;
  /** Saves a user-confirmed correction for a field's future matching. */
  onFieldCorrection?: (field: DetectedField, correctedTo: FieldType) => void | Promise<void>;
  /** Internal field references used by the rendered result rows. */
  fields?: DetectedField[];
}

export interface OverlayProgress {
  /** Some cascade controls are still resolving while completed fields are shown. */
  pendingCascade?: boolean;
}

const FIELD_LABELS: Record<FieldType, string> = {
  FULL_NAME: "Họ và tên",
  ID_NUMBER: "Số CCCD",
  PHONE: "Số điện thoại",
  EMAIL: "Email",
  DATE_OF_BIRTH: "Ngày sinh",
  ADDRESS: "Địa chỉ",
  GENDER: "Giới tính",
  PROVINCE: "Tỉnh/Thành phố",
  WARD: "Phường/Xã",
  DISTRICT_LEGACY: "Quận/Huyện",
  COMPANY_NAME: "Tên công ty",
  UNKNOWN: "Trường chưa nhận diện",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!;
  });
}

function getFieldName(field: DetectedField): string {
  const signals = field.signals;
  return (
    signals.visibleQuestionText ??
    signals.labelText ??
    signals.ariaLabel ??
    signals.placeholder ??
    signals.name ??
    FIELD_LABELS[field.candidateType]
  );
}

function renderFieldRow(
  field: DetectedField,
  index: number,
  selectable: boolean,
  correctable: boolean,
): string {
  const confidence = Math.max(0, Math.min(100, Math.round(field.confidence)));
  const matched = field.status === "filled";
  const fieldName = escapeHtml(getFieldName(field));
  const status = matched
    ? `<span class="field-status is-matched">✓ Matched ${confidence}%</span>`
    : field.status === "verify_failed"
      ? `<span class="field-status is-review">! Check ${confidence}%</span>`
      : field.status === "policy_blocked"
        ? `<span class="field-status is-review">Skipped: policy</span>`
        : field.status === "ambiguous"
          ? `<span class="field-status is-review">Skipped: ambiguous</span>`
          : field.status === "low_confidence"
            ? `<span class="field-status is-review">Skipped: low confidence</span>`
            : field.status === "duplicate_manual"
              ? `<span class="field-status is-review">trùng loại — tự nhập</span>`
              : field.status === "prepopulated_mismatch"
                ? `<span class="field-status is-review">đã điền nhưng khác profile — kiểm tra lại</span>`
                : field.status === "format_mismatch"
                  ? `<span class="field-status is-review">định dạng không khớp</span>`
      : field.status === "cascade_timeout"
        ? `<span class="field-status is-review">đang chờ / không tự chọn được — vui lòng chọn tay</span>`
      : `<span class="field-status">○ Not found</span>`;
  const name = selectable
    ? `<button class="field-name field-jump" type="button" data-field-index="${index}" aria-label="Đi tới trường ${fieldName}">${fieldName}${field.status === "cascade_timeout" ? ":" : ""}</button>`
    : `<span class="field-name">${fieldName}${field.status === "cascade_timeout" ? ":" : ""}</span>`;
  const correction = correctable
    ? `<button class="field-correction" type="button" data-field-correction="${index}">Sửa match</button>`
    : "";
  return `<li class="field-row${selectable ? " is-selectable" : ""}">${name}${status}${correction}</li>`;
}

function renderCorrectionPicker(): string {
  const options = (Object.entries(FIELD_LABELS) as Array<[FieldType, string]>)
    .filter(([type]) => type !== "UNKNOWN")
    .map(([type, label]) => `<option value="${type}">${label}</option>`)
    .join("");
  return `<section class="correction-picker" data-correction-picker hidden aria-live="polite">
    <p data-correction-title></p>
    <label>Loại field đúng <select data-correction-type>${options}</select></label>
    <div><button class="action-button" type="button" data-correction-cancel>Huỷ</button><button class="action-button is-primary" type="button" data-correction-save>Lưu cải thiện</button></div>
    <p class="correction-status" data-correction-status></p>
  </section>`;
}

function renderOverlay(
  { title, message, variant = "info", content = "", actions }: OverlayOptions,
  ownerDocument: Document = document,
): void {
  ownerDocument.getElementById(OVERLAY_HOST_ID)?.remove();

  const host = ownerDocument.createElement("div");
  host.id = OVERLAY_HOST_ID;
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("right", "16px", "important");
  host.style.setProperty("bottom", "16px", "important");
  host.style.setProperty("z-index", "2147483647", "important");

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .panel { width: min(380px, calc(100vw - 32px)); padding: 14px 38px 14px 15px; border: 1px solid ${variant === "warning" ? "#d0802a" : "#2867dc"}; border-radius: 10px; color: #1d2939; background: #ffffff; box-shadow: 0 8px 24px rgb(15 23 42 / 20%); font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.4; }
      .label { margin: 0 0 3px; color: ${variant === "warning" ? "#9a5714" : "#1f58c4"}; font-size: 11px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
      h2 { margin: 0; font-size: 14px; line-height: 1.35; }
      .message { margin: 5px 0 0; color: #596579; font-size: 12px; }
      .field-list { display: grid; gap: 6px; max-height: 180px; margin: 12px 0 0; padding: 0; overflow: auto; list-style: none; }
      .field-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 9px; border-radius: 6px; background: #f6f8fc; font-size: 12px; }
      .field-row.is-selectable:hover { background: #eaf1ff; }
      .field-name { overflow: hidden; color: #344158; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
      .field-jump { min-width: 0; padding: 0; border: 0; color: #344158; background: transparent; cursor: pointer; font: inherit; font-weight: 650; text-align: left; }
      .field-jump:hover, .field-jump:focus-visible { color: #1f58c4; outline: 2px solid #8aafe9; outline-offset: 2px; }
      .field-status { flex: 0 0 auto; color: #788397; font-size: 11px; font-weight: 650; }
      .field-status.is-matched { color: #148044; }
      .field-status.is-review { color: #b35c08; }
      .safety-notice { margin: 10px 0 0; padding: 8px 9px; border-radius: 6px; color: #596579; background: #f6f8fc; font-size: 11px; font-weight: 600; }
      .actions { display: flex; gap: 8px; margin-top: 12px; }
      .action-button { min-height: 30px; padding: 0 10px; border: 1px solid #cfd7e5; border-radius: 6px; color: #344158; background: #fff; cursor: pointer; font: 700 11px/1 Inter, ui-sans-serif, system-ui, sans-serif; letter-spacing: .03em; }
      .action-button:hover, .action-button:focus-visible { border-color: #2867dc; color: #1f58c4; background: #f2f6ff; outline: none; }
      .action-button.is-primary { border-color: #2867dc; color: #fff; background: #2867dc; }
      .action-button.is-primary:hover, .action-button.is-primary:focus-visible { background: #1f58c4; }
      .action-button:disabled { cursor: wait; opacity: .65; }
      .field-correction { flex: 0 0 auto; padding: 3px 5px; border: 0; border-radius: 4px; color: #1f58c4; background: #eaf1ff; cursor: pointer; font: 700 10px/1 Inter, ui-sans-serif, system-ui, sans-serif; }
      .field-correction:hover, .field-correction:focus-visible { background: #dce9ff; outline: 2px solid #8aafe9; outline-offset: 1px; }
      .correction-picker { margin-top: 10px; padding: 9px; border: 1px solid #b9cae9; border-radius: 7px; background: #f6f9ff; color: #344158; font-size: 11px; }
      .correction-picker p { margin: 0 0 7px; font-weight: 650; }
      .correction-picker label { display: grid; gap: 4px; font-weight: 650; }
      .correction-picker select { width: 100%; height: 29px; padding: 0 5px; border: 1px solid #b8c5d9; border-radius: 5px; color: #344158; background: #fff; font: inherit; }
      .correction-picker div { display: flex; gap: 6px; margin-top: 8px; }
      .correction-status { min-height: 14px; margin: 7px 0 0 !important; color: #168044; font-weight: 600 !important; }
      button { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border: 0; border-radius: 6px; color: #667085; background: transparent; cursor: pointer; font: 20px/1 sans-serif; }
      button:hover, button:focus-visible { color: #172033; background: #edf1f7; outline: none; }
    </style>
    <section id="${OVERLAY_PANEL_ID}" class="panel" role="status" aria-live="polite">
      <p class="label">Smart Form Autofill</p>
      <h2>${title}</h2>
      <p class="message">${message}</p>
      ${content}
      ${actions?.onFieldCorrection ? renderCorrectionPicker() : ""}
      <p class="safety-notice">Hãy tự kiểm tra và bấm Submit gốc của form.</p>
      ${
        actions
          ? `<div class="actions"><button class="action-button" type="button" data-overlay-action="rescan">SCAN LẠI</button><button class="action-button is-primary" type="button" data-overlay-action="refill">ĐIỀN LẠI</button></div>`
          : ""
      }
      <button type="button" aria-label="Đóng thông báo">×</button>
    </section>
  `;
  shadow
    .querySelector('button[aria-label="Đóng thông báo"]')
    ?.addEventListener("click", () => host.remove());
  if (actions) {
    const runAction = (callback: () => void | Promise<void>) => {
      shadow.querySelectorAll<HTMLButtonElement>("[data-overlay-action]").forEach((button) => {
        button.disabled = true;
      });
      void callback();
    };
    shadow
      .querySelector<HTMLButtonElement>('[data-overlay-action="rescan"]')
      ?.addEventListener("click", () => runAction(actions.onRescan));
    shadow
      .querySelector<HTMLButtonElement>('[data-overlay-action="refill"]')
      ?.addEventListener("click", () => runAction(actions.onRefill));

    if (actions.onFieldSelect) {
      const selectField = (index: number) => {
        const field = actions.fields?.[index];
        if (field) actions.onFieldSelect?.(field);
      };
      shadow.querySelectorAll<HTMLElement>("[data-field-index]").forEach((row) => {
        const index = Number(row.dataset.fieldIndex);
        row.addEventListener("click", () => selectField(index));
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectField(index);
          }
        });
      });
    }

    if (actions.onFieldCorrection) {
      let correctionIndex: number | undefined;
      const picker = shadow.querySelector<HTMLElement>("[data-correction-picker]");
      const title = shadow.querySelector<HTMLElement>("[data-correction-title]");
      const select = shadow.querySelector<HTMLSelectElement>("[data-correction-type]");
      const save = shadow.querySelector<HTMLButtonElement>("[data-correction-save]");
      const cancel = shadow.querySelector<HTMLButtonElement>("[data-correction-cancel]");
      const correctionStatus = shadow.querySelector<HTMLElement>("[data-correction-status]");

      shadow.querySelectorAll<HTMLButtonElement>("[data-field-correction]").forEach((button) => {
        button.addEventListener("click", () => {
          correctionIndex = Number(button.dataset.fieldCorrection);
          const field = actions.fields?.[correctionIndex];
          if (!field || !picker || !title || !select) return;
          title.textContent = `Sửa nhận diện: ${getFieldName(field)}`;
          select.value = field.candidateType === "UNKNOWN" ? "FULL_NAME" : field.candidateType;
          if (correctionStatus) correctionStatus.textContent = "";
          picker.hidden = false;
          select.focus();
        });
      });
      cancel?.addEventListener("click", () => {
        if (picker) picker.hidden = true;
      });
      save?.addEventListener("click", () => {
        const field = correctionIndex === undefined ? undefined : actions.fields?.[correctionIndex];
        if (!field || !select || !picker) return;
        save.disabled = true;
        void Promise.resolve(actions.onFieldCorrection!(field, select.value as FieldType))
          .then(() => {
            if (correctionStatus) correctionStatus.textContent = "Đã lưu cho lần quét sau trên website này.";
          })
          .catch(() => {
            if (correctionStatus) correctionStatus.textContent = "Không thể lưu. Vui lòng thử lại.";
          })
          .finally(() => {
            save.disabled = false;
          });
      });
    }
  }
  (ownerDocument.body ?? ownerDocument.documentElement).append(host);
}

/** Displays a scoped, non-blocking notice after scanning and filling a form. */
export function showAutofillOverlay(
  results: DetectedField[],
  ownerDocument: Document = document,
  actions?: OverlayActions,
  progress?: OverlayProgress,
): void {
  const filled = results.filter(({ status }) => status === "filled").length;
  const needsReview = results.filter(({ status }) => status === "verify_failed").length;
  const cascadeTimeouts = results.filter(({ status }) => status === "cascade_timeout").length;
  const policyBlocked = results.filter(({ status }) => status === "policy_blocked").length;
  const ambiguous = results.filter(({ status }) => status === "ambiguous").length;
  const lowConfidence = results.filter(({ status }) => status === "low_confidence").length;
  const duplicates = results.filter(({ status }) => status === "duplicate_manual").length;
  const prepopulatedMismatch = results.filter(
    ({ status }) => status === "prepopulated_mismatch",
  ).length;
  const formatMismatch = results.filter(({ status }) => status === "format_mismatch").length;
  const message = policyBlocked
    ? `Đã điền ${filled} trường. Có ${policyBlocked} trường bị chặn bởi policy an toàn.`
    : ambiguous
      ? `Đã điền ${filled} trường. Có ${ambiguous} trường nhận diện mơ hồ, vui lòng chọn tay.`
      : lowConfidence
        ? `Đã điền ${filled} trường. Có ${lowConfidence} trường có confidence thấp.`
        : duplicates
          ? `Đã điền ${filled} trường. Có ${duplicates} trường trùng loại cần tự nhập.`
          : prepopulatedMismatch
            ? `Đã điền ${filled} trường. Có ${prepopulatedMismatch} trường đã có giá trị khác profile.`
            : formatMismatch
              ? `Đã điền ${filled} trường. Có ${formatMismatch} trường có định dạng không khớp.`
    : cascadeTimeouts
    ? `Đã điền ${filled} trường. Có ${cascadeTimeouts} trường không tự chọn được — vui lòng chọn tay.`
    : needsReview
    ? `Đã điền ${filled} trường. Có ${needsReview} trường cần kiểm tra lại.`
    : `Đã điền ${filled} trường. Hãy kiểm tra thông tin trước khi gửi form.`;
  const content = results.length
    ? `<ul class="field-list" aria-label="Kết quả nhận diện field">${results.map((field, index) => renderFieldRow(field, index, Boolean(actions?.onFieldSelect), Boolean(actions?.onFieldCorrection))).join("")}</ul>`
    : "";
  renderOverlay(
    {
      title: progress?.pendingCascade ? "Đang điền form" : "Đã hoàn tất điền form",
      message: progress?.pendingCascade
        ? `${message} Các trường phụ thuộc đang tiếp tục xử lý.`
        : message,
      content,
      actions: actions ? { ...actions, fields: results } : undefined,
    },
    ownerDocument,
  );
}

/** Scrolls to the scanned input and applies a short, high-priority highlight. */
export function scrollToAndHighlightField(field: DetectedField): void {
  const element = resolveLiveElement(field.stableLocator) ?? field.elementRef.deref();
  if (!element) return;

  element.scrollIntoView?.({ behavior: "smooth", block: "center" });
  element.focus?.({ preventScroll: true });

  const outline = element.style.getPropertyValue("outline");
  const outlinePriority = element.style.getPropertyPriority("outline");
  const outlineOffset = element.style.getPropertyValue("outline-offset");
  const outlineOffsetPriority = element.style.getPropertyPriority("outline-offset");
  element.style.setProperty("outline", "3px solid #2563eb", "important");
  element.style.setProperty("outline-offset", "3px", "important");

  window.setTimeout(() => {
    if (outline) element.style.setProperty("outline", outline, outlinePriority);
    else element.style.removeProperty("outline");
    if (outlineOffset)
      element.style.setProperty("outline-offset", outlineOffset, outlineOffsetPriority);
    else element.style.removeProperty("outline-offset");
  }, 2000);
}

/** Shows a scoped warning without allowing page styles to affect its contents. */
export function showOverlayWarning(
  title: string,
  message: string,
  ownerDocument: Document = document,
): void {
  renderOverlay({ title, message, variant: "warning" }, ownerDocument);
}
