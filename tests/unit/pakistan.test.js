"use strict";

const {
  isValidCnic,
  isValidPhonePk,
  normalizePhonePk,
  cnicDigits,
} = require("../../utils/pakistan");

describe("pakistan validation", () => {
  test("CNIC accepts 13 digits with formatting", () => {
    expect(isValidCnic("35202-1234567-1")).toBe(true);
    expect(cnicDigits("35202-1234567-1")).toBe("3520212345671");
    expect(isValidCnic("352021234567")).toBe(false);
    expect(isValidCnic("35202-abc4567-1")).toBe(false);
  });

  test("phone accepts 03xx and +92 forms", () => {
    expect(isValidPhonePk("03001234567")).toBe(true);
    expect(isValidPhonePk("03131464155")).toBe(true);
    expect(isValidPhonePk("+92 300 1234567")).toBe(true);
    expect(normalizePhonePk("+923001234567")).toBe("03001234567");
    expect(isValidPhonePk("0300abc4567")).toBe(false);
    expect(isValidPhonePk("04001234567")).toBe(false);
  });
});
