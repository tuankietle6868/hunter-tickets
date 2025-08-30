import { GoogleFormsAdapter } from "./adapters/googleFormsAdapter";

export const UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID = "smart-form-autofill-unsupported-google-form";

/** Identifies both published respondent URLs and the legacy Forms URL shape. */
export function isGoogleFormsPage(location: Location = window.location): boolean {
  return location.hostname === "docs.google.com" && location.pathname.startsWith("/forms/");
}

/**
 * Renders one non-blocking explanation rather than attempting a broad generic
 * fill on a Google Forms page whose question DOM is no longer recognised.
 */
export function showUnsupportedGoogleFormOverlay(ownerDocument: Document = document): void {
  if (ownerDocument.getElementById(UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID)) {
    return;
  }

  const overlay = ownerDocument.createElement("div");
  overlay.id = UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID;
  overlay.setAttribute("role", "alert");
  overlay.setAttribute("aria-live", "polite");
  overlay.textContent =
    "Không nhận diện được cấu trúc Google Forms này. Không có dữ liệu nào được điền.";
  overlay.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "max-width:360px",
    "padding:12px 16px",
    "border:1px solid #b3261e",
    "border-radius:8px",
    "background:#fff8f6",
    "color:#5f2120",
    "font:14px/1.4 system-ui,sans-serif",
    "box-shadow:0 2px 8px rgb(0 0 0 / 20%)",
  ].join(";");

  (ownerDocument.body ?? ownerDocument.documentElement).append(overlay);
}

/**
 * Prevents fallback to GenericHtmlAdapter on a Google Forms URL, where an
 * unknown DOM shape could otherwise associate labels and controls incorrectly.
 */
export function getGoogleFormsAdapterOrShowFallback(
  showFallback = true,
): GoogleFormsAdapter | null {
  const adapter = new GoogleFormsAdapter();

  if (adapter.isApplicable()) {
    return adapter;
  }

  if (showFallback) showUnsupportedGoogleFormOverlay();
  return null;
}
