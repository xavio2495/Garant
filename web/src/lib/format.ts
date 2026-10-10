// 6-decimal amounts (AUSD, PROTECT) to display strings
export const toNum6 = (v: bigint) => Number(v) / 1e6;
export const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
export const php = (v: number, digits = 0) =>
  `₱${v.toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fx8 = (v: bigint) => Number(v) / 1e8;
export const date = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
