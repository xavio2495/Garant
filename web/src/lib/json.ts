// JSON responses with bigint values serialised as strings
export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

export const fail = (status: number, error: string) => json({ error }, { status });
