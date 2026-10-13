/**
 * Centralized Marketing Proof Figures and Metrics.
 *
 * Ground rule 6: "Every proof figure on this page is a placeholder...
 * They are props in a group labelled 'Proof figures (must be real)'
 * so they can be corrected or emptied in one place."
 *
 * Update these with verified production figures or empty strings ("")
 * to gracefully suppress the badge/proof element.
 */

import { FREE_RESUME_LIMIT } from "@/lib/limits";
import { PRO_PRICES, SINGLE_UNLOCK } from "@/lib/marketing/plans";

export interface MarketingProofFigures {
  chromeRating: string;
  installCount: string;
  userCount: string;
  avgAutofillTime: string;
  factsTraced: string;
  heroMatchScore: number;
  oneTimeUnlockPrice: string;
  proMonthlyPrice: string;
  freeApplicationsCount: number;
}

export const PROOF_FIGURES: MarketingProofFigures = {
  chromeRating: "4.8",
  installCount: "1,200+",
  userCount: "3,400+",
  avgAutofillTime: "1.4s",
  factsTraced: "0 invented facts, 31 of 31 traced",
  heroMatchScore: 78,
  oneTimeUnlockPrice: SINGLE_UNLOCK.priceLabel,
  proMonthlyPrice: PRO_PRICES.month.label,
  freeApplicationsCount: FREE_RESUME_LIMIT,
};
