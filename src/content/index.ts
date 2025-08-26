import { getProfile } from "../shared/storage";
import { runGenericAutofill } from "./pipeline";

async function runContentScript(): Promise<void> {
  const profile = await getProfile();
  if (!profile) {
    return;
  }

  const results = runGenericAutofill(profile);
  console.log("[Smart Form Autofill] Generic fill results:", results);
}

void runContentScript();
