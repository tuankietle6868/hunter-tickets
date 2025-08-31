import { getProfile, isOverlayAutoEnabled } from "../shared/storage";
import { getGoogleFormsAdapterOrShowFallback, isGoogleFormsPage } from "./googleFormsFallback";
import { showAutofillOverlay } from "./overlayUI";
import { runGenericAutofill } from "./pipeline";

async function runContentScript(): Promise<void> {
  // Read the per-domain preference before creating any automatic overlay UI.
  const overlayAutoEnabled = await isOverlayAutoEnabled(window.location.hostname);
  const onGoogleFormsPage = isGoogleFormsPage();
  const googleFormsAdapter = onGoogleFormsPage
    ? getGoogleFormsAdapterOrShowFallback(overlayAutoEnabled)
    : undefined;

  if (onGoogleFormsPage && !googleFormsAdapter) {
    return;
  }

  const profile = await getProfile();
  if (!profile) {
    return;
  }

  const results = await runGenericAutofill(profile, googleFormsAdapter);
  if (overlayAutoEnabled) showAutofillOverlay(results);
  console.log("[Smart Form Autofill] Fill results:", results);
}

void runContentScript();
