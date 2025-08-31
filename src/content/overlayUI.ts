import type { DetectedField, FieldType } from "../shared/types";

export const OVERLAY_HOST_ID = "smart-form-autofill-overlay-host";
export const OVERLAY_PANEL_ID = "smart-form-autofill-overlay";

export type OverlayVariant = "info" | "warning";

interface OverlayOptions {
  title: string;
  message: string;
  variant?: OverlayVariant;
  content?: string;
}

const FIELD_LABELS: Record<FieldType, string> = {
  FULL_NAME: "Họ và tên",
  ID_NUMBER: "Số CCCD",
  PHONE: "Số điện thoại",
  EMAIL: "Email",
  DATE_OF_BIRTH: "Ngày sinh",
  ADDRESS: "Địa chỉ",
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

function renderFieldRow(field: DetectedField): string {
  const confidence = Math.max(0, Math.min(100, Math.round(field.confidence)));
  const matched = field.status === "filled";
  const status = matched
    ? `<span class="field-status is-matched">✓ Matched ${confidence}%</span>`
    : field.status === "verify_failed"
      ? `<span class="field-status is-review">! Check ${confidence}%</span>`
      : `<span class="field-status">○ Not found</span>`;
  return `<li class="field-row"><span class="field-name">${escapeHtml(getFieldName(field))}</span>${status}</li>`;
}

function renderOverlay(
  { title, message, variant = "info", content = "" }: OverlayOptions,
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
      .field-name { overflow: hidden; color: #344158; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
      .field-status { flex: 0 0 auto; color: #788397; font-size: 11px; font-weight: 650; }
      .field-status.is-matched { color: #148044; }
      .field-status.is-review { color: #b35c08; }
      button { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border: 0; border-radius: 6px; color: #667085; background: transparent; cursor: pointer; font: 20px/1 sans-serif; }
      button:hover, button:focus-visible { color: #172033; background: #edf1f7; outline: none; }
    </style>
    <section id="${OVERLAY_PANEL_ID}" class="panel" role="status" aria-live="polite">
      <p class="label">Smart Form Autofill</p>
      <h2>${title}</h2>
      <p class="message">${message}</p>
      ${content}
      <button type="button" aria-label="Đóng thông báo">×</button>
    </section>
  `;
  shadow.querySelector("button")?.addEventListener("click", () => host.remove());
  (ownerDocument.body ?? ownerDocument.documentElement).append(host);
}

/** Displays a scoped, non-blocking notice after scanning and filling a form. */
export function showAutofillOverlay(
  results: DetectedField[],
  ownerDocument: Document = document,
): void {
  const filled = results.filter(({ status }) => status === "filled").length;
  const needsReview = results.filter(({ status }) => status === "verify_failed").length;
  const message = needsReview
    ? `Đã điền ${filled} trường. Có ${needsReview} trường cần kiểm tra lại.`
    : `Đã điền ${filled} trường. Hãy kiểm tra thông tin trước khi gửi form.`;
  const content = results.length
    ? `<ul class="field-list" aria-label="Kết quả nhận diện field">${results.map(renderFieldRow).join("")}</ul>`
    : "";
  renderOverlay({ title: "Đã hoàn tất điền form", message, content }, ownerDocument);
}

/** Shows a scoped warning without allowing page styles to affect its contents. */
export function showOverlayWarning(
  title: string,
  message: string,
  ownerDocument: Document = document,
): void {
  renderOverlay({ title, message, variant: "warning" }, ownerDocument);
}
