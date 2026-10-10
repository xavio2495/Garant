import { listSeries, openUsdPhpSeries, quote, sizeFxFloor } from "@/lib/garant";
import { publicClient } from "@/lib/chain";
import { fail, json } from "@/lib/json";
import { referenceRate } from "@/lib/fx";

// GET /api/quote?notionalUsd=200 quotes the open USD/PHP floor for a transfer.
// GET /api/quote?seriesId=1&protectAmount=1000000 quotes any series directly.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const all = await listSeries(publicClient);

  if (q.has("notionalUsd")) {
    const notionalUsd = Number(q.get("notionalUsd"));
    if (!(notionalUsd > 0 && notionalUsd <= 10_000)) return fail(400, "notionalUsd must be greater than 0 and at most 10000");
    const s = openUsdPhpSeries(all);
    if (!s) return fail(404, "No open exchange-rate guarantee right now");
    const protectAmount = sizeFxFloor({ notionalUsd: BigInt(Math.round(notionalUsd * 1e6)), strike: s.strike, lower: s.lower });
    try {
      const [q2, reference] = await Promise.all([quote(publicClient, { seriesId: s.id, protectAmount }), referenceRate()]);
      return json({ series: s, quote: q2, reference });
    } catch (e) {
      return fail(409, `Not enough offers to price this guarantee: ${(e as Error).message}`);
    }
  }

  const id = q.get("seriesId");
  const amount = q.get("protectAmount");
  if (id === null || amount === null) return fail(400, "Pass notionalUsd, or seriesId and protectAmount");
  if (!/^\d+$/.test(id) || !/^\d+$/.test(amount)) return fail(400, "seriesId and protectAmount must be whole numbers");
  const s = all.find((x) => x.id === BigInt(id));
  if (!s) return fail(404, `Series ${id} not found`);
  try {
    return json({ series: s, quote: await quote(publicClient, { seriesId: s.id, protectAmount: BigInt(amount) }) });
  } catch (e) {
    return fail(409, `Not enough offers to price this guarantee: ${(e as Error).message}`);
  }
}
