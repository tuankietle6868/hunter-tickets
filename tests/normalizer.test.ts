import { describe, expect, it } from "vitest";

import { normalize, stripDiacritics } from "../src/shared/normalizer";

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
