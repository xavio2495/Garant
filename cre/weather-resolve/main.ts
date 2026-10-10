import {
  bytesToHex,
  ConsensusAggregationByFields,
  CronCapability,
  EVMClient,
  encodeCallMsg,
  getNetwork,
  handler,
  hexToBase64,
  HTTPClient,
  type HTTPSendRequester,
  LAST_FINALIZED_BLOCK_NUMBER,
  median,
  Runner,
  type Runtime,
  TxStatus,
} from "@chainlink/cre-sdk";
import {
  type Abi,
  type Address,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import { decideFx, decodePair, type FxSpec, fxSourceAUrl, fxSourceBUrl, parseFxA, parseFxB } from "./src/fx";
import { decide, parseA, parseB, sourceAUrl, sourceBUrl, type WeatherSpec } from "./src/weather";

export type Config = {
  schedule: string;
  chainName: string;
  outcomeSeries: string;
  creResolver: string;
  creFxResolver: string;
  fxTolBps: number;
};

const KIND_BINARY = 0;
const KIND_FX_FLOOR = 1;
const STATE_OPEN = 0;
const MAX_REPORTS_PER_RUN = 5;
// Chain reads allowed per execution by the CRE runtime.
const MAX_READS = 15;
// Reads one candidate can cost: series, pending, spec.
const READS_PER_SERIES = 3;
// Measured: a report costs about 141k gas end to end; Monad bills the limit, so keep headroom small.
const GAS_LIMIT = "200000";

const outcomeSeriesAbi = parseAbi([
  "struct Series { uint8 kind; uint8 state; address resolver; bytes32 oracleRef; int64 strike; int64 lower; uint64 expiry; address protect; address back; address market; uint128 payout; }",
  "function seriesCount() view returns (uint256)",
  "function series(uint256 id) view returns (Series)",
]);

const creResolverAbi = parseAbi([
  "function spec(uint256 id) view returns (int32 lat1e4, int32 lon1e4, uint32 yyyymmdd, bool registered)",
  "function pending(uint256 id) view returns (bool exists, uint8 outcome, uint64 finalizeAfter)",
]);

const creFxResolverAbi = parseAbi([
  "function spec(uint256 id) view returns (bytes32 pair, uint32 yyyymmdd, bool registered)",
  "function pending(uint256 id) view returns (bool exists, uint8 outcome, uint64 finalizeAfter)",
]);

const reportParams = parseAbiParameters("uint256 id, uint8 outcome, int64 observedA, int64 observedB");

export const encodeReport = (id: bigint, outcome: number, observedA: bigint, observedB: bigint): Hex =>
  encodeAbiParameters(reportParams, [id, outcome, observedA, observedB]);

// Millimetres per source; -1 means not published yet.
type Observation = { a: number; b: number };

const fetchJson = (requester: HTTPSendRequester, url: string): unknown => {
  const resp = requester.sendRequest({ url, method: "GET" }).result();
  if (resp.statusCode !== 200) return null;
  return JSON.parse(new TextDecoder().decode(resp.body));
};

const fetchObservation = (requester: HTTPSendRequester, spec: WeatherSpec): Observation => ({
  a: parseA(fetchJson(requester, sourceAUrl(spec))) ?? -1,
  b: parseB(fetchJson(requester, sourceBUrl(spec)), spec.yyyymmdd) ?? -1,
});

// Rate per source; -1 means missing or not for the requested date.
type FxObservation = { a: number; b: number };

const fetchFx = (requester: HTTPSendRequester, spec: FxSpec): FxObservation => ({
  a: parseFxA(fetchJson(requester, fxSourceAUrl(spec)), spec) ?? -1,
  b: parseFxB(fetchJson(requester, fxSourceBUrl(spec)), spec) ?? -1,
});

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const { chainName, outcomeSeries, creResolver, creFxResolver, fxTolBps } = runtime.config;
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: chainName });
  if (!network) throw new Error(`Network not found: ${chainName}`);
  const evm = new EVMClient(network.chainSelector.selector);
  const http = new HTTPClient();

  let reads = 0;
  const read = (to: string, abi: Abi, functionName: string, args: readonly unknown[] = []): any => {
    reads++;
    const res = evm
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: to as Address, data: encodeFunctionData({ abi, functionName, args }) }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();
    return decodeFunctionResult({ abi, functionName, data: bytesToHex(res.data) });
  };

  const now = BigInt(Math.floor(runtime.now().getTime() / 1000));
  const count: bigint = read(outcomeSeries, outcomeSeriesAbi, "seriesCount");
  let reported = 0;

  for (let id = 0n; id < count && reported < MAX_REPORTS_PER_RUN && reads + READS_PER_SERIES <= MAX_READS; id++) {
    const s = read(outcomeSeries, outcomeSeriesAbi, "series", [id]);
    if (s.state !== STATE_OPEN || s.expiry > now) continue;
    const resolver = s.resolver.toLowerCase();

    let receiver: string;
    let outcome: number;
    let a: bigint;
    let b: bigint;
    if (s.kind === KIND_BINARY && resolver === creResolver.toLowerCase()) {
      const [exists] = read(creResolver, creResolverAbi, "pending", [id]);
      if (exists) continue;
      const [lat1e4, lon1e4, yyyymmdd, registered] = read(creResolver, creResolverAbi, "spec", [id]);
      if (!registered) continue;

      const spec: WeatherSpec = { lat1e4, lon1e4, yyyymmdd };
      const obs = http
        .sendRequest(runtime, fetchObservation, ConsensusAggregationByFields<Observation>({ a: median, b: median }))(spec)
        .result();
      const d = decide(obs.a < 0 ? null : obs.a, obs.b < 0 ? null : obs.b, s.strike);
      if (d.kind === "retry") {
        runtime.log(`series ${id}: retry (${d.reason})`);
        continue;
      }
      [receiver, outcome, a, b] = [creResolver, d.outcome, d.observedA, d.observedB];
    } else if (s.kind === KIND_FX_FLOOR && resolver === creFxResolver.toLowerCase()) {
      const [exists] = read(creFxResolver, creFxResolverAbi, "pending", [id]);
      if (exists) continue;
      const [pair, yyyymmdd, registered] = read(creFxResolver, creFxResolverAbi, "spec", [id]);
      if (!registered) continue;

      const spec: FxSpec = { ...decodePair(pair), yyyymmdd };
      const obs = http
        .sendRequest(runtime, fetchFx, ConsensusAggregationByFields<FxObservation>({ a: median, b: median }))(spec)
        .result();
      const d = decideFx(obs.a < 0 ? null : obs.a, obs.b < 0 ? null : obs.b, fxTolBps);
      if (d.kind === "retry") {
        runtime.log(`series ${id}: retry (${d.reason})`);
        continue;
      }
      [receiver, outcome, a, b] = [creFxResolver, d.outcome, d.rateA, d.rateB];
    } else continue;

    const report = runtime
      .report({
        encodedPayload: hexToBase64(encodeReport(id, outcome, a, b)),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();
    const tx = evm.writeReport(runtime, { receiver, report, gasConfig: { gasLimit: GAS_LIMIT } }).result();
    const hash = bytesToHex(tx.txHash ?? new Uint8Array(32));
    runtime.log(`series ${id}: outcome ${outcome} A=${a} B=${b} tx ${hash} status ${TxStatus[tx.txStatus]}`);
    reported++;
  }
  return `reported ${reported}`;
};

export const initWorkflow = (config: Config) => [
  handler(new CronCapability().trigger({ schedule: config.schedule }), onCronTrigger),
];

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
