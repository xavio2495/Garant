import { setDeployments, type Deployments } from "@garant/sdk";
import deployments from "../../../deployments/10143.json";

setDeployments(deployments as Deployments);

export * from "@garant/sdk";
export { deployments };

// The USD/PHP floor currently on sale: open, not yet expired, earliest fixing first
export const openUsdPhpSeries = (all: import("@garant/sdk").SeriesView[]) =>
  all
    .filter((s) => s.kind === "FX_FLOOR" && s.state === "OPEN" && s.label.startsWith("USD/PHP") && s.expiry > Date.now() / 1000)
    .sort((a, b) => a.expiry - b.expiry)[0];
