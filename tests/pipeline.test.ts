import { afterEach, describe, expect, it } from "vitest";

import { runGenericAutofill } from "../src/content/pipeline";

describe("generic autofill pipeline", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("scans, matches, fills, and verifies a standard HTML form", async () => {
    document.body.innerHTML = `
      <form>
        <label for="full-name">Họ và tên</label>
        <input id="full-name" type="text" />
        <label>Email liên hệ <input type="email" /></label>
        <label for="unknown">Mã giới thiệu</label>
        <input id="unknown" type="text" />
      </form>
    `;

    const results = await runGenericAutofill({
      fullName: "Nguyễn Văn An",
      email: "an@example.com",
    });
    const inputs = document.querySelectorAll<HTMLInputElement>("input");

    expect(inputs[0].value).toBe("Nguyễn Văn An");
    expect(inputs[1].value).toBe("an@example.com");
    expect(inputs[2].value).toBe("");
    expect(results.map(({ candidateType, status }) => ({ candidateType, status }))).toEqual([
      { candidateType: "FULL_NAME", status: "filled" },
      { candidateType: "EMAIL", status: "filled" },
      { candidateType: "UNKNOWN", status: "skipped" },
    ]);
  });
});
