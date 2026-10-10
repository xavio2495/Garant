import { listSeries } from "@/lib/garant";
import { publicClient } from "@/lib/chain";
import { json } from "@/lib/json";

export async function GET() {
  return json({ series: await listSeries(publicClient) });
}
