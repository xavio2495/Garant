"use client";

import { useQuery } from "@tanstack/react-query";
import type { SeriesView } from "@/lib/garant";

type Wire = Omit<SeriesView, "id" | "strike" | "lower" | "payout"> & { id: string; strike: string; lower: string; payout: string };

export function useSeries() {
  return useQuery({
    queryKey: ["series"],
    queryFn: async (): Promise<SeriesView[]> => {
      const j = (await (await fetch("/api/series")).json()) as { series: Wire[] };
      return j.series.map((s) => ({ ...s, id: BigInt(s.id), strike: BigInt(s.strike), lower: BigInt(s.lower), payout: BigInt(s.payout) }));
    },
    staleTime: 60_000,
  });
}
