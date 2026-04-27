import {
  generateCode,
  has2FA,
  mark2FAPassed,
  clear2FA,
  getTierDiscount,
  getAddonsTotal,
  getTotalPriceStr,
} from "./app.logic.js";

// ── generateCode ──────────────────────────────────────────────
describe("generateCode()", () => {
  test("returns a 4-digit string", () => {
    expect(generateCode()).toHaveLength(4);
  });

  test("only contains digits", () => {
    expect(generateCode()).toMatch(/^\d{4}$/);
  });

  test("value is between 1000 and 9999", () => {
    const code = Number(generateCode());
    expect(code).toBeGreaterThanOrEqual(1000);
    expect(code).toBeLessThanOrEqual(9999);
  });
});

// ── 2FA session helpers ───────────────────────────────────────
describe("2FA session helpers", () => {
  let fakeStorage;

  beforeEach(() => {
    // Reset fake storage before each test
    fakeStorage = { _data: {}, getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = v; }, removeItem(k) { delete this._data[k]; } };
  });

  test("has2FA() returns false when key is absent", () => {
    expect(has2FA(fakeStorage)).toBe(false);
  });

  test("mark2FAPassed() sets dk_2fa to '1'", () => {
    mark2FAPassed(fakeStorage);
    expect(fakeStorage.getItem("dk_2fa")).toBe("1");
  });

  test("has2FA() returns true after mark2FAPassed()", () => {
    mark2FAPassed(fakeStorage);
    expect(has2FA(fakeStorage)).toBe(true);
  });

  test("clear2FA() removes the flag", () => {
    mark2FAPassed(fakeStorage);
    clear2FA(fakeStorage);
    expect(has2FA(fakeStorage)).toBe(false);
  });
});

// ── getTierDiscount ───────────────────────────────────────────
describe("getTierDiscount()", () => {
  test("Carbon tier returns 0% discount", () => {
    expect(getTierDiscount("Carbon").pct).toBe(0);
  });

  test("Stone tier returns 10% discount", () => {
    expect(getTierDiscount("Stone").pct).toBe(10);
  });

  test("Pearl tier returns 100% discount", () => {
    expect(getTierDiscount("Pearl").pct).toBe(100);
  });
});

// ── getAddonsTotal ────────────────────────────────────────────
describe("getAddonsTotal()", () => {
  test("returns 0 with no add-ons", () => {
    expect(getAddonsTotal([])).toBe(0);
  });

  test("returns correct sum for one add-on", () => {
    expect(getAddonsTotal([{ price: 5 }])).toBe(5);
  });

  test("returns correct sum for all three add-ons", () => {
    expect(getAddonsTotal([{ price: 15 }, { price: 15 }, { price: 5 }])).toBe(35);
  });
});

// ── getTotalPriceStr ──────────────────────────────────────────
describe("getTotalPriceStr()", () => {
  test("Carbon tier, no add-ons: £25", () => {
    expect(getTotalPriceStr(25, 0, 0)).toBe("£25");
  });

  test("Stone tier 10% off base, plus £5 add-on: £28", () => {
  // 25 - Math.round(25 * 0.10) + 5 = 25 - 3 + 5 = £27
  expect(getTotalPriceStr(25, 10, 5)).toBe("£27");
});

  test("Pearl tier: base waived, add-ons still charged", () => {
    expect(getTotalPriceStr(25, 100, 5)).toBe("£5");
  });

  test("never returns a negative price", () => {
    expect(getTotalPriceStr(25, 100, 0)).toBe("£0");
  });
});