import type { DetectedField } from "../shared/types";

/** Related controls whose scan results must be cached and invalidated together. */
export interface FieldGroup {
  kind: "cascade" | "date_of_birth";
  elements: readonly HTMLElement[];
}

/**
 * Keeps detection results tied to their live DOM nodes. Cascade members listen
 * for a parent value change so every dependent select is re-detected against
 * the parent\'s newly rendered options on the next scan.
 */
export class FieldDetectionCache {
  private readonly fields = new WeakMap<HTMLElement, DetectedField>();
  private readonly groups = new WeakMap<HTMLElement, FieldGroup>();

  get(element: HTMLElement): DetectedField | undefined {
    return this.fields.get(element);
  }

  set(element: HTMLElement, field: DetectedField): DetectedField {
    this.fields.set(element, field);
    return field;
  }

  getOrCreate(element: HTMLElement, create: () => DetectedField): DetectedField {
    return this.get(element) ?? this.set(element, create());
  }

  /** Associates elements with their group and installs cascade invalidation once. */
  registerGroup(group: FieldGroup): FieldGroup {
    const existing = this.groups.get(group.elements[0]);
    if (
      existing?.kind === group.kind &&
      existing.elements.length === group.elements.length &&
      existing.elements.every((element, index) => element === group.elements[index])
    ) {
      return existing;
    }

    group.elements.forEach((element, index) => {
      this.groups.set(element, group);
      if (group.kind !== "cascade" || !(element instanceof HTMLSelectElement)) return;

      element.addEventListener("change", () => {
        if (this.groups.get(element) !== group) return;
        this.invalidateDependents(group, index);
      });
    });
    return group;
  }

  /** Removes cached results for every cascade select after the changed parent. */
  invalidateDependents(group: FieldGroup, parentIndex: number): void {
    if (group.kind !== "cascade") return;
    group.elements.slice(parentIndex + 1).forEach((element) => this.fields.delete(element));
  }
}

/** Shared cache for repeated re-scans of the current content-script document. */
export const detectedFieldCache = new FieldDetectionCache();
