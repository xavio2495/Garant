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
import { decide, parseA, parseB, sourceAUrl, sourceBUrl, type WeatherSpec } from "./src/weather";

export type Config = {
  schedule: string;
  chainName: string;
  outcomeSeries: string;
  creResolver: string;
};

const KIND_BINARY = 0;
const STATE_OPEN = 0;
const MAX_REPORTS_PER_RUN = 5;
const GAS_LIMIT = "500000";

const outcomeSeriesAbi = parseAbi([
  "struct Series { uint8 kind; uint8 state; address resolver; bytes32 oracleRef; int64 strike; int64 lower; uint64 expiry; address protect; address back; address market; uint128 payout; }",
  "function seriesCount() view returns (uint256)",
  "function series(uint256 id) view returns (Series)",
]);

const creResolverAbi = parseAbi([
  "function spec(uint256 id) view returns (int32 lat1e4, int32 lon1e4, uint32 yyyymmdd, bool registered)",
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

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const { chainName, outcomeSeries, creResolver } = runtime.config;
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: chainName });
  if (!network) throw new Error(`Network not found: ${chainName}`);
  const evm = new EVMClient(network.chainSelector.selector);
  const http = new HTTPClient();

  const read = (to: string, abi: Abi, functionName: string, args: readonly unknown[] = []): any => {
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

  for (let id = 0n; id < count && reported < MAX_REPORTS_PER_RUN; id++) {
    const s = read(outcomeSeries, outcomeSeriesAbi, "series", [id]);
    if (s.kind !== KIND_BINARY || s.state !== STATE_OPEN) continue;
    if (s.resolver.toLowerCase() !== creResolver.toLowerCase() || s.expiry > now) continue;

    const [lat1e4, lon1e4, yyyymmdd, registered] = read(creResolver, creResolverAbi, "spec", [id]);
    if (!registered) continue;
    const [exists] = read(creResolver, creResolverAbi, "pending", [id]);
    if (exists) continue;

    const spec: WeatherSpec = { lat1e4, lon1e4, yyyymmdd };
    const obs = http
      .sendRequest(runtime, fetchObservation, ConsensusAggregationByFields<Observation>({ a: median, b: median }))(spec)
      .result();
    const d = decide(obs.a < 0 ? null : obs.a, obs.b < 0 ? null : obs.b, s.strike);
    if (d.kind === "retry") {
      runtime.log(`series ${id}: retry (${d.reason})`);
      continue;
    }

    const report = runtime
      .report({
        encodedPayload: hexToBase64(encodeReport(id, d.outcome, d.observedA, d.observedB)),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();
    const tx = evm.writeReport(runtime, { receiver: creResolver, report, gasConfig: { gasLimit: GAS_LIMIT } }).result();
    const hash = bytesToHex(tx.txHash ?? new Uint8Array(32));
    runtime.log(
      `series ${id}: outcome ${d.outcome} A=${d.observedA} B=${d.observedB} tx ${hash} status ${TxStatus[tx.txStatus]}`,
    );
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
