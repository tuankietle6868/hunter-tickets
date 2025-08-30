import { getProfile } from "../shared/storage";
import {
  getGoogleFormsAdapterOrShowFallback,
  isGoogleFormsPage,
} from "./googleFormsFallback";
import { runGenericAutofill } from "./pipeline";

async function runContentScript(): Promise<void> {
  const onGoogleFormsPage = isGoogleFormsPage();
  const googleFormsAdapter = onGoogleFormsPage
    ? getGoogleFormsAdapterOrShowFallback()
    : undefined;

  if (onGoogleFormsPage && !googleFormsAdapter) {
    return;
  }

  const profile = await getProfile();
  if (!profile) {
    return;
  }

  const results = await runGenericAutofill(
    profile,
    googleFormsAdapter,
  );
  console.log("[Smart Form Autofill] Fill results:", results);
}

void runContentScript();
