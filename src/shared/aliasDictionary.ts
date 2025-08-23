import type { FieldType } from "./types";

export type AliasMatchType = "exact" | "contains" | "regex";

export interface AliasEntry {
  pattern: string;
  weight: number;
  matchType: AliasMatchType;
}

const exact = (pattern: string, weight: number): AliasEntry => ({
  pattern,
  weight,
  matchType: "exact",
});

const contains = (pattern: string, weight: number): AliasEntry => ({
  pattern,
  weight,
  matchType: "contains",
});

/**
 * Field-name aliases after text has been normalized and stripped of diacritics.
 * `UNKNOWN` is intentionally empty because it is never a positive match.
 */
export const ALIAS_DICTIONARY: Record<FieldType, AliasEntry[]> = {
  FULL_NAME: [
    exact("ho va ten", 100),
    exact("ho ten", 100),
    exact("full name", 100),
    exact("name", 60),
    exact("ho va chu lot ten", 100),
    exact("ten day du", 100),
    exact("hoten", 95),
    exact("fullname", 95),
  ],
  PHONE: [
    exact("so dien thoai", 100),
    contains("dien thoai", 90),
    exact("sdt", 100),
    contains("phone", 90),
    contains("mobile", 85),
    exact("dt", 85),
    exact("so dt", 95),
    contains("phone number", 95),
    exact("tel", 90),
    contains("telephone", 90),
  ],
  ID_NUMBER: [
    exact("cccd", 100),
    contains("can cuoc cong dan", 100),
    exact("cmnd", 95),
    contains("id number", 90),
    contains("citizen id", 90),
    contains("so cccd", 100),
    contains("so cmnd", 95),
    contains("chung minh nhan dan", 95),
    contains("identity card", 90),
    contains("national id", 90),
  ],
  EMAIL: [
    contains("email", 100),
    contains("e-mail", 100),
    contains("dia chi email", 100),
    contains("thu dien tu", 95),
    exact("mail", 80),
  ],
  DATE_OF_BIRTH: [
    contains("ngay sinh", 100),
    contains("date of birth", 100),
    exact("dob", 90),
    contains("ngay thang nam sinh", 100),
    contains("birth date", 95),
    exact("birthday", 85),
    contains("ngay sinh nhat", 85),
  ],
  ADDRESS: [
    contains("dia chi", 100),
    contains("address", 90),
    contains("dia chi lien he", 100),
    contains("dia chi thuong tru", 100),
    contains("dia chi hien tai", 95),
    exact("noi o", 85),
  ],
  UNKNOWN: [],
};
