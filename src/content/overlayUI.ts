import type { DetectedField, FieldType } from "../shared/types";

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
  /** Internal field references used by the rendered result rows. */
  fields?: DetectedField[];
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

function renderFieldRow(field: DetectedField, index: number, selectable: boolean): string {
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
      : field.status === "cascade_timeout"
        ? `<span class="field-status is-review">đang chờ / không tự chọn được — vui lòng chọn tay</span>`
      : `<span class="field-status">○ Not found</span>`;
  return `<li class="field-row${selectable ? " is-selectable" : ""}"${selectable ? ` data-field-index="${index}" role="button" tabindex="0" aria-label="Đi tới trường ${fieldName}"` : ""}><span class="field-name">${fieldName}${field.status === "cascade_timeout" ? ":" : ""}</span>${status}</li>`;
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
      .field-row.is-selectable { cursor: pointer; }
      .field-row.is-selectable:hover, .field-row.is-selectable:focus-visible { background: #eaf1ff; outline: 2px solid #8aafe9; outline-offset: 1px; }
      .field-name { overflow: hidden; color: #344158; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
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
      button { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border: 0; border-radius: 6px; color: #667085; background: transparent; cursor: pointer; font: 20px/1 sans-serif; }
      button:hover, button:focus-visible { color: #172033; background: #edf1f7; outline: none; }
    </style>
    <section id="${OVERLAY_PANEL_ID}" class="panel" role="status" aria-live="polite">
      <p class="label">Smart Form Autofill</p>
      <h2>${title}</h2>
      <p class="message">${message}</p>
      ${content}
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
  }
  (ownerDocument.body ?? ownerDocument.documentElement).append(host);
}

/** Displays a scoped, non-blocking notice after scanning and filling a form. */
export function showAutofillOverlay(
  results: DetectedField[],
  ownerDocument: Document = document,
  actions?: OverlayActions,
): void {
  const filled = results.filter(({ status }) => status === "filled").length;
  const needsReview = results.filter(({ status }) => status === "verify_failed").length;
  const cascadeTimeouts = results.filter(({ status }) => status === "cascade_timeout").length;
  const policyBlocked = results.filter(({ status }) => status === "policy_blocked").length;
  const ambiguous = results.filter(({ status }) => status === "ambiguous").length;
  const lowConfidence = results.filter(({ status }) => status === "low_confidence").length;
  const message = policyBlocked
    ? `Đã điền ${filled} trường. Có ${policyBlocked} trường bị chặn bởi policy an toàn.`
    : ambiguous
      ? `Đã điền ${filled} trường. Có ${ambiguous} trường nhận diện mơ hồ, vui lòng chọn tay.`
      : lowConfidence
        ? `Đã điền ${filled} trường. Có ${lowConfidence} trường có confidence thấp.`
    : cascadeTimeouts
    ? `Đã điền ${filled} trường. Có ${cascadeTimeouts} trường không tự chọn được — vui lòng chọn tay.`
    : needsReview
    ? `Đã điền ${filled} trường. Có ${needsReview} trường cần kiểm tra lại.`
    : `Đã điền ${filled} trường. Hãy kiểm tra thông tin trước khi gửi form.`;
  const content = results.length
    ? `<ul class="field-list" aria-label="Kết quả nhận diện field">${results.map((field, index) => renderFieldRow(field, index, Boolean(actions?.onFieldSelect))).join("")}</ul>`
    : "";
  renderOverlay(
    {
      title: "Đã hoàn tất điền form",
      message,
      content,
      actions: actions ? { ...actions, fields: results } : undefined,
    },
    ownerDocument,
  );
}

/** Scrolls to the scanned input and applies a short, high-priority highlight. */
export function scrollToAndHighlightField(field: DetectedField): void {
  const element = field.elementRef.deref();
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
