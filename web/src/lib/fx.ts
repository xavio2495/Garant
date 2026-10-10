// Latest ECB reference rate for USD/PHP (the same fixing FX guarantees settle on)
export async function referenceRate(): Promise<{ rate: number; date: string } | null> {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=PHP", { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { date: string; rates: { PHP: number } };
    return { rate: j.rates.PHP, date: j.date };
  } catch {
    return null;
  }
}
