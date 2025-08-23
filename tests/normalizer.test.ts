import { describe, expect, it } from "vitest";

import {
  cleanQuestionText,
  normalize,
  stripDiacritics,
} from "../src/shared/normalizer";

describe("normalize", () => {
  it("lowercases text", () => {
    expect(normalize("Họ Và Tên")).toBe("họ và tên");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalize("  số điện thoại  ")).toBe("số điện thoại");
  });

  it("collapses consecutive whitespace", () => {
    expect(normalize("địa\t\tchỉ\n nhà")).toBe("địa chỉ nhà");
  });

  it("applies all normalizations together", () => {
    expect(normalize("  EMAIL   LIÊN HỆ  ")).toBe("email liên hệ");
  });
});

describe("stripDiacritics", () => {
  it("removes Vietnamese tone marks and converts đ", () => {
    expect(stripDiacritics("Số điện thoại")).toBe("so dien thoai");
  });
});

describe("cleanQuestionText", () => {
  it("cleans a required full-name question (Form A)", () => {
    expect(cleanQuestionText("1. Họ và tên *")).toBe("Họ và tên");
  });

  it("cleans a required phone question (Form B)", () => {
    expect(cleanQuestionText("2. Số điện thoại (bắt buộc)")).toBe("Số điện thoại");
  });

  it("cleans combined decorations from an email question (Form C)", () => {
    expect(cleanQuestionText("  3.   Email liên hệ * (BẮT BUỘC)  ")).toBe(
      "Email liên hệ",
    );
  });
});
