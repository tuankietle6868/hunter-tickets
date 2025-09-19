import { describe, expect, it } from "vitest";

import { FieldDetectionCache } from "../src/content/fieldCache";
import type { DetectedField } from "../src/shared/types";

function detectedField(element: HTMLElement): DetectedField {
  return {
    elementRef: new WeakRef(element),
    controlType: "SELECT",
    signals: {},
    candidateType: "UNKNOWN",
    confidence: 0,
    status: "filled",
  };
}

describe("FieldDetectionCache", () => {
  it("invalidates cached ward after the filled province changes", () => {
    document.body.innerHTML = `
      <select id="province"><option value="79">Hồ Chí Minh</option><option value="01">Hà Nội</option></select>
      <select id="ward"><option value="26734">Phường Bến Nghé</option></select>
    `;
    const province = document.querySelector<HTMLSelectElement>("#province")!;
    const ward = document.querySelector<HTMLSelectElement>("#ward")!;
    const cache = new FieldDetectionCache();
    const cachedWard = detectedField(ward);
    cache.set(province, detectedField(province));
    cache.set(ward, cachedWard);
    cache.registerGroup({ kind: "cascade", elements: [province, ward] });

    province.value = "01";
    province.dispatchEvent(new Event("change", { bubbles: true }));

    expect(cache.get(province)).toBeDefined();
    expect(cache.get(ward)).toBeUndefined();
    expect(ward.value).toBe("26734");
  });
});
