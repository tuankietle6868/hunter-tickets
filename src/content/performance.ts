import type { DetectedField } from "../shared/types";

/** Maximum accepted end-to-end duration for one non-cascading field. */
export const INSTANT_FIELD_MAX_DURATION_MS = 1_000;

function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(1)}ms`;
}

/** Logs the measured scan-to-verify duration for a field without dependencies. */
export function logInstantFieldDuration(field: DetectedField, durationMs: number): void {
  const description = field.signals.labelText ?? field.signals.name ?? field.candidateType;
  const message = `[Smart Form Autofill] Instant field SCAN→FILL→VERIFY (${description}): ${formatDuration(durationMs)}`;
  if (durationMs > INSTANT_FIELD_MAX_DURATION_MS) {
    console.error(`${message} — exceeded the 1000ms performance target.`);
    return;
  }
  console.info(message);
}

/**
 * Logs cascade timing for diagnostics only. Network and third-party form
 * latency are expected here, so this path deliberately has no failure limit.
 */
export function logCascadeDuration(durationMs: number): void {
  console.info(
    `[Smart Form Autofill] Cascade SCAN→FILL→VERIFY: ${formatDuration(durationMs)} (network-dependent; no performance failure threshold).`,
  );
}

export function performanceNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}
