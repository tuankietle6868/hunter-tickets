import { GoogleFormsAdapter } from "./adapters/googleFormsAdapter";
import { OVERLAY_HOST_ID, showOverlayWarning } from "./overlayUI";

export const UNSUPPORTED_GOOGLE_FORM_OVERLAY_ID = OVERLAY_HOST_ID;

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

  showOverlayWarning(
    "Không nhận diện được Google Forms",
    "Không có dữ liệu nào được điền.",
    ownerDocument,
  );
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
