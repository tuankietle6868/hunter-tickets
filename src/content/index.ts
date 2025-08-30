import { getProfile } from "../shared/storage";
import { GoogleFormsAdapter } from "./adapters/googleFormsAdapter";
import { runGenericAutofill } from "./pipeline";

async function runContentScript(): Promise<void> {
  const profile = await getProfile();
  if (!profile) {
    return;
  }

  const googleFormsAdapter = new GoogleFormsAdapter();
  const results = await runGenericAutofill(
    profile,
    googleFormsAdapter.isApplicable() ? googleFormsAdapter : undefined,
  );
  console.log("[Smart Form Autofill] Fill results:", results);
}

void runContentScript();
