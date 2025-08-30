import type { FieldSignals } from "../../shared/types";

/**
 * A DOM container representing one question in a form.
 *
 * An adapter may use the input itself as the block when the page has no
 * higher-level question wrapper.
 */
export type QuestionBlock = HTMLElement;

/**
 * Contract for form-specific DOM adapters used by the scan, fill, and verify
 * workflow. Implementations encapsulate page-specific selectors and events.
 */
export interface IFormAdapter {
  /** Whether this adapter supports the form in the current document. */
  isApplicable(): boolean;

  /** Locate the question containers that can be scanned. */
  findQuestions(): QuestionBlock[];

  /** Extract matching hints for a question. */
  getQuestionText(question: QuestionBlock): FieldSignals;

  /** Locate the editable control within a question, if it is supported. */
  findInput(question: QuestionBlock): HTMLElement | null;

  /** Write a value to an editable control. */
  setValue(input: HTMLElement, value: string): void;

  /**
   * Confirm that an editable control still contains the expected value.
   * Adapters for controlled frameworks may wait for their next render.
   */
  verifyValue(input: HTMLElement, expected: string): boolean | Promise<boolean>;
}
