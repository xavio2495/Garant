import { isAddress } from "viem";
import { status } from "@/lib/garant";
import { publicClient } from "@/lib/chain";
import { fail, json } from "@/lib/json";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("seriesId");
  const account = q.get("account");
  if (id === null || !account || !isAddress(account)) return fail(400, "Pass seriesId and a valid account");
  try {
    return json(await status(publicClient, { seriesId: BigInt(id), account }));
  } catch (e) {
    return fail(404, (e as Error).message);
  }
}
