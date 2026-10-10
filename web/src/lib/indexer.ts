// Minimal GraphQL client for the Envio indexer
const URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8080/v1/graphql";

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const j = (await r.json()) as { data?: T };
    return j.data ?? null;
  } catch {
    return null;
  }
}
