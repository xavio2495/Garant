import { describe, expect, test } from "bun:test";
import { stringToHex } from "viem";
import { decideFx, decodePair, FX_OUTCOME, fxSourceAUrl, fxSourceBUrl, parseFxA, parseFxB } from "./fx";

const spec = { base: "USD", quote: "PHP", yyyymmdd: 20261009 };
const realA = { amount: 1.0, base: "USD", date: "2026-10-09", rates: { PHP: 62.821 } };
const realB = { date: "2026-10-09", usd: { php: 62.78972049, eur: 0.86 } };

describe("pair", () => {
  test("decodes bytes32('USD/PHP')", () => expect(decodePair(stringToHex("USD/PHP", { size: 32 }))).toEqual({ base: "USD", quote: "PHP" }));
  test("generic USD quote", () => expect(decodePair(stringToHex("USD/idr", { size: 32 }))).toEqual({ base: "USD", quote: "IDR" }));
  test("rejects garbage", () => expect(() => decodePair(stringToHex("USDPHP", { size: 32 }))).toThrow());
});

describe("urls", () => {
  test("A", () => expect(fxSourceAUrl(spec)).toBe("https://api.frankfurter.dev/v1/2026-10-09?base=USD&symbols=PHP"));
  test("B", () =>
    expect(fxSourceBUrl(spec)).toBe("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2026-10-09/v1/currencies/usd.json"));
});

describe("parse", () => {
  test("A value", () => expect(parseFxA(realA, spec)).toBe(62.821));
  test("B value", () => expect(parseFxB(realB, spec)).toBe(62.78972049));
  test("A weekend: Frankfurter returns the previous fixing date", () =>
    expect(parseFxA({ ...realA, date: "2026-10-09" }, { ...spec, yyyymmdd: 20261010 })).toBeNull());
  test("B date mismatch", () => expect(parseFxB({ ...realB, date: "2026-10-08" }, spec)).toBeNull());
  test("missing quote", () => expect(parseFxA({ ...realA, rates: {} }, spec)).toBeNull());
  test("null body", () => expect(parseFxB(null, spec)).toBeNull());
});

describe("decideFx (tol 50 bps)", () => {
  test("real 2026-10-09 values -> OK", () =>
    expect(decideFx(62.821, 62.78972049, 50)).toEqual({ kind: "report", outcome: FX_OUTCOME.OK, rateA: 6282100000n, rateB: 6278972049n }));
  test("weekend -> retry", () =>
    expect(decideFx(parseFxA(realA, { ...spec, yyyymmdd: 20261010 }), 62.79, 50)).toEqual({ kind: "retry", reason: "source A missing or wrong date" }));
  test("B missing -> retry", () => expect(decideFx(62.821, null, 50)).toMatchObject({ kind: "retry" }));
  test("big disagreement -> VOID", () => expect(decideFx(62.821, 60.1, 50)).toMatchObject({ kind: "report", outcome: FX_OUTCOME.VOID }));
});
