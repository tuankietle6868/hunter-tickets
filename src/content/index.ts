import {
  getFieldMatchFeedback,
  getProfile,
  isOverlayAutoEnabled,
  saveFieldMatchFeedback,
} from "../shared/storage";
import { MicrosoftFormsAdapter } from "./adapters/microsoftFormsAdapter";
import { ReactVueAdapter } from "./adapters/reactVueAdapter";
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
  const microsoftFormsAdapter = isMicrosoftFormsPage() ? new MicrosoftFormsAdapter() : undefined;
  const genericFrameworkAdapter = new ReactVueAdapter();

  if (onGoogleFormsPage && !googleFormsAdapter) {
    return;
  }

  const profile = await getProfile();
  if (!profile) {
    return;
  }
  const learnedFeedback = await getFieldMatchFeedback(window.location.hostname);

  const independentResults: import("../shared/types").DetectedField[] = [];
  const renderOverlay = (
    results: import("../shared/types").DetectedField[],
    pendingCascade = false,
  ) => {
    if (!overlayAutoEnabled) return;
    showAutofillOverlay(
      results,
      document,
      {
        onRescan: runContentScript,
        onRefill: runContentScript,
        onFieldSelect: scrollToAndHighlightField,
        onFieldCorrection: async (field, correctedTo) => {
          await saveFieldMatchFeedback(
            window.location.hostname,
            field.signals,
            field.candidateType,
            correctedTo,
          );
        },
      },
      { pendingCascade },
    );
  };
  const results = await runGenericAutofill(
    profile,
    googleFormsAdapter ?? microsoftFormsAdapter ?? genericFrameworkAdapter,
    {
      onIndependentFieldComplete: (field) => {
        independentResults.push(field);
        renderOverlay(independentResults, true);
      },
      learnedFeedback,
    },
  );
  observeDynamicFieldChanges();
  renderOverlay(results);
  console.log("[Smart Form Autofill] Fill results:", results);
}

function isMicrosoftFormsPage(location: Location = window.location): boolean {
  return location.hostname === "forms.office.com" || location.hostname === "forms.cloud.microsoft";
}

void runContentScript();
