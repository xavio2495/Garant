import { describe, expect, test } from "bun:test";
import { decide, parseA, parseB, sourceAUrl, sourceBUrl, OUTCOME } from "./weather";

const manila = { lat1e4: 145995, lon1e4: 1209842, yyyymmdd: 20260910 };

describe("urls", () => {
  test("source A", () => {
    expect(sourceAUrl(manila)).toContain("latitude=14.5995&longitude=120.9842&start_date=2026-09-10&end_date=2026-09-10");
  });
  test("source B", () => {
    expect(sourceBUrl(manila)).toContain("start=20260910&end=20260910");
  });
});

describe("parse", () => {
  test("A value", () => expect(parseA({ daily: { precipitation_sum: [30.5] } })).toBe(30.5));
  test("A missing", () => expect(parseA({ daily: { precipitation_sum: [null] } })).toBeNull());
  test("B value", () => expect(parseB({ header: { fill_value: -999 }, properties: { parameter: { PRECTOTCORR: { "20260910": 49.34 } } } }, 20260910)).toBe(49.34));
  test("B fill value means not published", () =>
    expect(parseB({ header: { fill_value: -999 }, properties: { parameter: { PRECTOTCORR: { "20260910": -999 } } } }, 20260910)).toBeNull());
});

describe("decide (strike 10 mm)", () => {
  const strike = 1000n;
  test("YES when both above", () => expect(decide(30.5, 49.34, strike)).toEqual({ kind: "report", outcome: OUTCOME.YES, observedA: 3050n, observedB: 4934n }));
  test("NO when both below", () => expect(decide(3.2, 3.35, strike)).toMatchObject({ outcome: OUTCOME.NO }));
  test("VOID when sources disagree", () => expect(decide(2.1, 35.23, strike)).toMatchObject({ outcome: OUTCOME.VOID }));
  test("boundary counts as YES", () => expect(decide(10, 10, strike)).toMatchObject({ outcome: OUTCOME.YES }));
  test("retry, never VOID, when B unpublished", () => expect(decide(5, null, strike)).toEqual({ kind: "retry", reason: "source B not published" }));
});
