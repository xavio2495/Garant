import { setDeployments, type Deployments } from "@garant/sdk";
import deployments from "../../../deployments/10143.json";

setDeployments(deployments as Deployments);

export * from "@garant/sdk";
export { deployments };

// Partner transfers are guaranteed for about a month, so short tester series are skipped
const PARTNER_MIN_TERM = 7 * 24 * 3600;

// The USD/PHP floor partners sell: open, at least a week to run, earliest fixing first
export const openUsdPhpSeries = (all: import("@garant/sdk").SeriesView[]) =>
  all
    .filter((s) => s.kind === "FX_FLOOR" && s.state === "OPEN" && s.label.startsWith("USD/PHP") && s.expiry > Date.now() / 1000 + PARTNER_MIN_TERM)
    .sort((a, b) => a.expiry - b.expiry)[0];
