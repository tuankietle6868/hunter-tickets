import type { DetectedField } from "../shared/types";

export const OVERLAY_HOST_ID = "smart-form-autofill-overlay-host";
export const OVERLAY_PANEL_ID = "smart-form-autofill-overlay";

export type OverlayVariant = "info" | "warning";

interface OverlayOptions {
  title: string;
  message: string;
  variant?: OverlayVariant;
}

function renderOverlay(
  { title, message, variant = "info" }: OverlayOptions,
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
      .panel { width: min(360px, calc(100vw - 32px)); padding: 14px 38px 14px 15px; border: 1px solid ${variant === "warning" ? "#d0802a" : "#2867dc"}; border-radius: 10px; color: #1d2939; background: #ffffff; box-shadow: 0 8px 24px rgb(15 23 42 / 20%); font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.4; }
      .label { margin: 0 0 3px; color: ${variant === "warning" ? "#9a5714" : "#1f58c4"}; font-size: 11px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
      h2 { margin: 0; font-size: 14px; line-height: 1.35; }
      .message { margin: 5px 0 0; color: #596579; font-size: 12px; }
      button { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border: 0; border-radius: 6px; color: #667085; background: transparent; cursor: pointer; font: 20px/1 sans-serif; }
      button:hover, button:focus-visible { color: #172033; background: #edf1f7; outline: none; }
    </style>
    <section id="${OVERLAY_PANEL_ID}" class="panel" role="status" aria-live="polite">
      <p class="label">Smart Form Autofill</p>
      <h2>${title}</h2>
      <p class="message">${message}</p>
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
  renderOverlay({ title: "Đã hoàn tất điền form", message }, ownerDocument);
}

/** Shows a scoped warning without allowing page styles to affect its contents. */
export function showOverlayWarning(
  title: string,
  message: string,
  ownerDocument: Document = document,
): void {
  renderOverlay({ title, message, variant: "warning" }, ownerDocument);
}
