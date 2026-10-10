import { describe, expect, test } from "bun:test";
import { decodeAbiParameters, parseAbiParameters } from "viem";
import { encodeReport } from "./main";

describe("encodeReport", () => {
  test("round-trips abi.encode(uint256 id, uint8 outcome, int64 observedA, int64 observedB)", () => {
    const hex = encodeReport(3n, 2, 1250n, 980n);
    expect(hex.length).toBe(2 + 4 * 64);
    const decoded = decodeAbiParameters(parseAbiParameters("uint256, uint8, int64, int64"), hex);
    expect(decoded).toEqual([3n, 2, 1250n, 980n]);
  });
});
