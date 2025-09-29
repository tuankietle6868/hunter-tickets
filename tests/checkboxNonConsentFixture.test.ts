import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { runGenericAutofill } from "../src/content/pipeline";
import { isHardPolicyBlocked } from "../src/content/policy";

describe("checkbox-non-consent fixture", () => {
  afterEach(() => document.body.replaceChildren());

  it("does not misclassify marketing opt-in as consent or tick it", async () => {
    document.documentElement.innerHTML = readFileSync(
      "public/manual-test/checkbox-non-consent.html",
      "utf8",
    );
    const checkbox = document.querySelector<HTMLInputElement>("#marketing-email")!;
    const profile = { email: "an@example.com" };

    expect(isHardPolicyBlocked({ labelText: "Đăng ký nhận email khuyến mãi" }, "EMAIL")).toBe(false);

    const firstRun = await runGenericAutofill(profile);
    const secondRun = await runGenericAutofill(profile);

    expect(checkbox.checked).toBe(false);
    expect(firstRun[0].status).not.toBe("policy_blocked");
    expect(secondRun[0].status).not.toBe("policy_blocked");
  });
});
