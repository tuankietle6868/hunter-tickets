import { describe, expect, it, vi } from "vitest";

import { observeDynamicFields } from "../src/content/dynamicFields";
import { GenericHtmlAdapter } from "../src/content/adapters/genericHtmlAdapter";

describe("dynamic form fields", () => {
  it("debounces consecutive container mutations into one rescan", async () => {
    document.body.innerHTML = '<form id="ticket-form"></form>';
    const form = document.querySelector<HTMLFormElement>("#ticket-form")!;
    const onRescan = vi.fn();
    const stop = observeDynamicFields(form, onRescan);

    form.append(new Option("Vé thường", "standard"));
    await new Promise((resolve) => setTimeout(resolve));
    form.append(new Option("Vé sinh viên", "student"));
    await new Promise((resolve) => setTimeout(resolve));
    form.append(new Option("Vé VIP", "vip"));

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(onRescan).toHaveBeenCalledOnce();
    stop();
  });

  it("does not repeatedly rescan while a field is replaced every 100ms for two seconds", async () => {
    document.body.innerHTML = '<form id="ticket-form"><div id="animation-slot"></div></form>';
    const form = document.querySelector<HTMLFormElement>("#ticket-form")!;
    const slot = document.querySelector<HTMLElement>("#animation-slot")!;
    const onRescan = vi.fn();
    const stop = observeDynamicFields(form, onRescan);

    for (let tick = 0; tick < 20; tick += 1) {
      slot.replaceChildren(document.createElement("input"));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Every change lands inside the 200ms debounce window, so no scan has run yet.
    expect(onRescan).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(onRescan).toHaveBeenCalledOnce();
    stop();
  }, 3_000);

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
