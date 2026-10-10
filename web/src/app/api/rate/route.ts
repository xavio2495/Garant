import { referenceRate } from "@/lib/fx";
import { fail, json } from "@/lib/json";

export async function GET() {
  const r = await referenceRate();
  return r ? json({ pair: "USD/PHP", source: "ECB", ...r }) : fail(502, "Reference rate unavailable");
}
