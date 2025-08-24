import type { FieldSignals, FieldType } from "../../src/shared/types";

export interface FieldFixture {
  description: string;
  signals: FieldSignals;
  expectedType: FieldType;
}

export interface FormFixture {
  name: "Form A" | "Form B" | "Form C";
  fields: FieldFixture[];
}

/**
 * Core-engine fixtures based on the six fields enumerated in the project
 * document: Họ tên, CCCD, SĐT, Email, Ngày sinh, and Địa chỉ.
 */
export const FORM_FIXTURES: FormFixture[] = [
  {
    name: "Form A",
    fields: [
      {
        description: "required full name",
        signals: {
          visibleQuestionText: "1. Họ và tên *",
          placeholder: "Nhập họ và tên",
          autocomplete: "name",
        },
        expectedType: "FULL_NAME",
      },
      {
        description: "required phone number",
        signals: {
          labelText: "2. Số điện thoại (bắt buộc)",
          placeholder: "Nhập số điện thoại liên hệ",
          autocomplete: "tel",
        },
        expectedType: "PHONE",
      },
    ],
  },
  {
    name: "Form B",
    fields: [
      {
        description: "citizen identity number",
        signals: {
          visibleQuestionText: "1. CCCD *",
          name: "cccd",
        },
        expectedType: "ID_NUMBER",
      },
      {
        description: "required email address",
        signals: {
          labelText: "2. Email liên hệ *",
          autocomplete: "email",
        },
        expectedType: "EMAIL",
      },
    ],
  },
  {
    name: "Form C",
    fields: [
      {
        description: "date of birth",
        signals: {
          visibleQuestionText: "1. Ngày tháng năm sinh",
          autocomplete: "bday",
        },
        expectedType: "DATE_OF_BIRTH",
      },
      {
        description: "contact address",
        signals: {
          labelText: "2. Địa chỉ liên hệ (bắt buộc)",
          placeholder: "Nhập địa chỉ",
        },
        expectedType: "ADDRESS",
      },
    ],
  },
];
