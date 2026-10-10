import { fail } from "@/lib/json";

// Buys protection from the partner's server wallet. Wired once the partner
// wallet (with its spending policy) and the contracts are live.
export async function POST() {
  return fail(503, "Guarantees can't be bought yet. The service is being set up.");
}
