import { describe, expect, it, vi } from "vitest";

import { observeDynamicFields } from "../src/content/dynamicFields";
import { GenericHtmlAdapter } from "../src/content/adapters/genericHtmlAdapter";

describe("dynamic form fields", () => {
  it("rescans after a selected option renders a new field", async () => {
    document.body.innerHTML = `
      <form id="ticket-form">
        <label>Loại vé <select id="ticket-type"><option value="standard">Thường</option><option value="student">Sinh viên</option></select></label>
      </form>
    `;
    const form = document.querySelector<HTMLFormElement>("#ticket-form")!;
    const select = document.querySelector<HTMLSelectElement>("#ticket-type")!;
    const adapter = new GenericHtmlAdapter();
    let resolveRescan: (() => void) | undefined;
    const rescanned = new Promise<void>((resolve) => {
      resolveRescan = resolve;
    });
    const onRescan = vi.fn(() => resolveRescan?.());
    const stop = observeDynamicFields(form, onRescan, 0);

    select.addEventListener("change", () => {
      form.insertAdjacentHTML(
        "beforeend",
        '<label for="student-id">Mã sinh viên <input id="student-id" type="text" /></label>',
      );
    });
    select.value = "student";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await rescanned;

    expect(onRescan).toHaveBeenCalledOnce();
    expect(adapter.findQuestions().map((question) => question.id)).toContain("student-id");
    stop();
  });
});
