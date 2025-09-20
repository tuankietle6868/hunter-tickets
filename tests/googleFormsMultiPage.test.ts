import { afterEach, describe, expect, it } from "vitest";

import { GoogleFormsAdapter } from "../src/content/adapters/googleFormsAdapter";
import { findDynamicFieldRoot, observeDynamicFields } from "../src/content/dynamicFields";
import { OVERLAY_HOST_ID, showAutofillOverlay } from "../src/content/overlayUI";
import { runGenericAutofill } from "../src/content/pipeline";

function page(questionId: string, title: string, type = "text"): string {
  return `<div role="list"><section role="listitem"><h3 id="${questionId}-title" role="heading">${title}</h3><input id="${questionId}" type="${type}" aria-labelledby="${questionId}-title" /></section></div>`;
}

describe("Google Forms multi-page rescan", () => {
  afterEach(() => document.body.replaceChildren());

  it("updates the overlay with fields from the current page after a page transition", async () => {
    document.body.innerHTML = `<main role="main">${page("full-name", "Họ và tên")}</main>`;
    const root = findDynamicFieldRoot(document)!;
    const adapter = new GoogleFormsAdapter();
    let resolvePageTwo!: () => void;
    const pageTwoRendered = new Promise<void>((resolve) => {
      resolvePageTwo = resolve;
    });

    const rescan = async () => {
      const results = await runGenericAutofill(
        { fullName: "Nguyễn Văn An", email: "an@example.com" },
        adapter,
      );
      showAutofillOverlay(results);
      if (results.some((field) => field.candidateType === "EMAIL")) resolvePageTwo();
    };
    const stop = observeDynamicFields(root, () => void rescan(), 0);

    await rescan();
    expect(document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent).toContain("Họ và tên");

    root.replaceChildren();
    root.insertAdjacentHTML("beforeend", page("email", "Email liên hệ", "email"));
    await pageTwoRendered;

    const overlayText = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot?.textContent;
    expect(overlayText).toContain("Email liên hệ");
    expect(overlayText).not.toContain("Họ và tên");
    stop();
  });

  it("does not include questions from a hidden Google Forms page", () => {
    document.body.innerHTML = `
      <main role="main">
        <div role="list" aria-hidden="true"><section role="listitem"><h3 role="heading">Họ và tên</h3><input type="text" /></section></div>
        ${page("email", "Email liên hệ", "email")}
      </main>
    `;

    expect(new GoogleFormsAdapter().findQuestions()).toHaveLength(1);
    expect(new GoogleFormsAdapter().getQuestionText(new GoogleFormsAdapter().findQuestions()[0])).toMatchObject({
      labelText: "Email liên hệ",
    });
  });
});
