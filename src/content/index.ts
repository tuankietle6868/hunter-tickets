import { getProfile, isOverlayAutoEnabled } from "../shared/storage";
import { getGoogleFormsAdapterOrShowFallback, isGoogleFormsPage } from "./googleFormsFallback";
import { findDynamicFieldRoot, observeDynamicFields } from "./dynamicFields";
import { scrollToAndHighlightField, showAutofillOverlay } from "./overlayUI";
import { runGenericAutofill } from "./pipeline";

let stopDynamicFieldObserver: (() => void) | undefined;
let observedDynamicFieldRoot: Element | null = null;

function observeDynamicFieldChanges(): void {
  const root = findDynamicFieldRoot(document);
  if (!root || root === observedDynamicFieldRoot) return;

  stopDynamicFieldObserver?.();
  observedDynamicFieldRoot = root;
  stopDynamicFieldObserver = observeDynamicFields(root, () => {
    void runContentScript();
  });
}

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
  observeDynamicFieldChanges();
  if (overlayAutoEnabled) {
    showAutofillOverlay(results, document, {
      onRescan: runContentScript,
      onRefill: runContentScript,
      onFieldSelect: scrollToAndHighlightField,
    });
  }
  console.log("[Smart Form Autofill] Fill results:", results);
}

void runContentScript();
