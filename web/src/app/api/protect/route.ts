import { isAddress, type Address } from "viem";
import { listSeries, openUsdPhpSeries, protect, quote, sizeFxFloor } from "@/lib/garant";
import { publicClient } from "@/lib/chain";
import { fail, json } from "@/lib/json";
import {
  MAX_AUSD_PER_REQUEST,
  PolicyError,
  capMessage,
  isPrivyPolicyDenial,
  partnerAddress,
  partnerWallet,
  usesPrivy,
} from "@/lib/partner-wallet";

// POST { notionalUsd, beneficiary? } buys a USD/PHP rate guarantee from the
// partner's wallet. Without a beneficiary the partner holds it and claims for
// the recipient.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { notionalUsd?: number; beneficiary?: string };
  const notionalUsd = Number(body.notionalUsd);
  if (!(notionalUsd > 0 && notionalUsd <= 10_000)) return fail(400, "notionalUsd must be greater than 0 and at most 10000");
  if (body.beneficiary !== undefined && !isAddress(body.beneficiary)) return fail(400, "beneficiary must be an address");
  const partner = partnerAddress();
  if (!partner) return fail(503, "Partner wallet is not configured");
  const beneficiary = (body.beneficiary ?? partner) as Address;

  const series = openUsdPhpSeries(await listSeries(publicClient));
  if (!series) return fail(404, "No open exchange-rate guarantee right now");
  const protectAmount = sizeFxFloor({ notionalUsd: BigInt(Math.round(notionalUsd * 1e6)), strike: series.strike, lower: series.lower });

  let q;
  try {
    q = await quote(publicClient, { seriesId: series.id, protectAmount });
  } catch (e) {
    return fail(409, `Not enough offers to price this guarantee: ${(e as Error).message}`);
  }
  // With a Privy wallet the cap is left to Privy's policy, which refuses to sign the approval
  if (!usesPrivy && q.costAusd > MAX_AUSD_PER_REQUEST) return fail(403, capMessage(q.costAusd));

  const signer = usesPrivy ? "privy" : "local";
  try {
    const maxCostAusd = usesPrivy ? q.costAusd : MAX_AUSD_PER_REQUEST;
    const txs = await protect(partnerWallet(series, beneficiary), { quote: q, beneficiary, maxCostAusd });
    return json({ seriesId: series.id, protectAmount, costAusd: q.costAusd, beneficiary, signer, txs });
  } catch (e) {
    if (isPrivyPolicyDenial(e)) {
      const why = q.costAusd > MAX_AUSD_PER_REQUEST ? ` ${capMessage(q.costAusd).replace("Policy: t", "T")}` : "";
      return fail(403, `Blocked by the Privy wallet policy.${why}`);
    }
    if (e instanceof PolicyError) return fail(403, e.message);
    return fail(502, `Purchase failed: ${(e as Error).message}`);
  }
}
