import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INSTANT_FIELD_MAX_DURATION_MS,
  logCascadeDuration,
  logInstantFieldDuration,
} from "../src/content/performance";
import type { DetectedField } from "../src/shared/types";

const field = {
  elementRef: new WeakRef(document.createElement("input")),
  controlType: "INPUT",
  signals: { labelText: "Họ và tên" },
  candidateType: "FULL_NAME",
  confidence: 100,
  status: "filled",
} as DetectedField;

describe("performance telemetry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("only reports an instant-field failure after one second", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logInstantFieldDuration(field, INSTANT_FIELD_MAX_DURATION_MS - 1);
    expect(info).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();

    logInstantFieldDuration(field, INSTANT_FIELD_MAX_DURATION_MS + 1);
    expect(error).toHaveBeenCalledOnce();
  });

  it("logs cascade timing without reporting a performance failure", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logCascadeDuration(25_000);

    expect(info).toHaveBeenCalledWith(expect.stringContaining("network-dependent"));
    expect(error).not.toHaveBeenCalled();
  });
});
