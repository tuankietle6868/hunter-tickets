import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FULL_FORM_SCAN_MATCH_MAX_DURATION_MS,
  INSTANT_FIELD_MAX_DURATION_MS,
  logCascadeDuration,
  logFullFormScanMatchDuration,
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

  it("reports a full-form SCAN→MATCH failure only after its one-second target", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logFullFormScanMatchDuration(60, FULL_FORM_SCAN_MATCH_MAX_DURATION_MS - 1);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Full-form SCAN→MATCH (60 fields)"));
    expect(error).not.toHaveBeenCalled();

    logFullFormScanMatchDuration(60, FULL_FORM_SCAN_MATCH_MAX_DURATION_MS + 1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("exceeded the 1000ms"));
  });
});
